import crypto from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { STORE_UTC_OFFSET_HOURS } from "@/lib/gift-shared";
import { cancelWindowCutoff } from "@/lib/order-policy";
import { round2 } from "@/lib/pricing";
import { getCancelWindowHours, getShopReferralRate, getShopWithdrawalMinimum } from "@/lib/settings";
import { decryptSession, derivePurposeKey, encryptSession } from "@/lib/session-token";
import { normalizePhone } from "@/lib/validation";
import {
  normalizeShopCode,
  isValidLinkCode,
  isValidShopReferralCode,
  SHOP_ATTRIBUTION_COOKIE,
} from "@/lib/shop-shared";

/**
 * The My Shop partner programme. Server-only.
 *
 *   1. Someone applies at /join-shop, and an admin approving the request creates
 *      their shop, which mints a public link code and a private access code. See
 *      the Shop model for why those are two different things.
 *   2. Anyone arriving through the link gets a cookie (src/proxy.js).
 *   3. Checkout reads that cookie and writes a ShopSale with the order.
 *   4. The partner types their access code at /my-shop to read their own figures,
 *      and only those: every query below is scoped to the shop in their session.
 *
 * A partner can also hand out their referral code to people joining. Each sale by a
 * shop they referred then earns them a share as well, on top of what that shop earns.
 */

// Fields that are safe to hand to the admin screens. Named explicitly so that
// accessCodeHash and accessCodeEncrypted can never leave the server through a
// whole-row read.
export const SHOP_PUBLIC_FIELDS = {
  id: true,
  ownerName: true,
  phone: true,
  email: true,
  investmentAed: true,
  commissionRate: true,
  linkCode: true,
  referralCode: true,
  isActive: true,
  createdAt: true,
};

export function serializeShop(shop) {
  return {
    ...shop,
    investmentAed: Number(shop.investmentAed),
    commissionRate: Number(shop.commissionRate),
  };
}

// ── Codes ───────────────────────────────────────────────────────────────────

// 0/O, 1/I and L are omitted because these codes get read out over the phone.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LINK_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const ACCESS_CODE_LENGTH = 12;
const LINK_CODE_LENGTH = 8;
const REFERRAL_CODE_LENGTH = 8;

function randomString(alphabet, length) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[crypto.randomInt(alphabet.length)];
  }
  return out;
}

/** A fresh access code, grouped for reading aloud: "K7MQ-2XPD-9RTA". */
export function generateShopCode() {
  return randomString(CODE_ALPHABET, ACCESS_CODE_LENGTH).replace(/(.{4})(?=.)/g, "$1-");
}

export function generateLinkCode() {
  return randomString(LINK_ALPHABET, LINK_CODE_LENGTH);
}

export function generateReferralCode() {
  return randomString(CODE_ALPHABET, REFERRAL_CODE_LENGTH);
}

// Cached because deriving it is deliberately slow.
let cachedCodeHashKey = null;

/**
 * What a code is stored and looked up as. Keyed with a secret that is not in the
 * database, so a leaked copy of it cannot be used to test guesses offline. Changing
 * SESSION_SECRET therefore stops every code working until an admin replaces it.
 */
export function hashShopCode(code) {
  cachedCodeHashKey ??= derivePurposeKey("shop-code-hash");
  return crypto.createHmac("sha256", cachedCodeHashKey).update(normalizeShopCode(code)).digest("hex");
}

// How codes were hashed before the key was added. Each one is upgraded the next time it
// is used, so nobody has to be given a new code.
function legacyHashShopCode(code) {
  return crypto.createHash("sha256").update(normalizeShopCode(code)).digest("hex");
}

/** The active shop a typed code opens, or null. */
export async function findActiveShopByCode(code) {
  const hash = hashShopCode(code);
  const shop = await prisma.shop.findFirst({
    where: { accessCodeHash: { in: [hash, legacyHashShopCode(code)] }, isActive: true },
    select: { id: true, accessCodeHash: true },
  });
  if (!shop) return null;

  if (shop.accessCodeHash !== hash) {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { accessCodeHash: hash },
      select: { id: true },
    });
  }
  return { id: shop.id };
}

/** Whether this is the shop's current access code, for confirming a sensitive change. */
export async function shopCodeMatches(shopId, code) {
  if (typeof code !== "string" || !code.trim()) return false;
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { accessCodeHash: true },
  });
  return (
    Boolean(shop) &&
    (shop.accessCodeHash === hashShopCode(code) || shop.accessCodeHash === legacyHashShopCode(code))
  );
}

// Cached because deriving it is deliberately slow.
let cachedAccessCodeKey = null;

function accessCodeKey() {
  cachedAccessCodeKey ??= derivePurposeKey("shop-access-code");
  return cachedAccessCodeKey;
}

/** The readable copy of an access code that only the admin console opens. */
export function encryptShopCode(code) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", accessCodeKey(), iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [iv, encrypted, cipher.getAuthTag()].map((part) => part.toString("hex")).join(":");
}

/**
 * Null for anything it cannot open: a shop from before codes were kept, a damaged
 * value, or one encrypted under a SESSION_SECRET that has since been changed.
 */
export function decryptShopCode(stored) {
  try {
    const [iv, encrypted, tag] = String(stored).split(":").map((part) => Buffer.from(part, "hex"));
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", accessCodeKey(), iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ── The partner's session ───────────────────────────────────────────────────

const SHOP_SESSION_COOKIE = "shop-session";
// Shorter than a customer session: this is a bearer pass to someone's earnings,
// and it is often opened on a phone that other people pick up.
const SHOP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export async function setShopSession(shopId) {
  const issuedAt = Date.now();
  // `kind` is what stops this token and a customer's being swapped for each other.
  // They are encrypted with the same key, so each reader has to check what it got.
  const token = encryptSession({
    kind: "shop",
    shopId,
    iat: issuedAt,
    exp: issuedAt + SHOP_SESSION_MAX_AGE_SECONDS * 1000,
  });
  const cookieStore = await cookies();
  cookieStore.set(SHOP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SHOP_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearShopSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SHOP_SESSION_COOKIE);
}

/**
 * The shop whose partner is signed in on this browser, or null. Re-checked against
 * the database on every read, so deactivating a shop or replacing its code takes
 * effect at once rather than when the cookie runs out.
 */
export const getCurrentShop = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SHOP_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = decryptSession(token);
  if (payload?.kind !== "shop" || !payload.shopId) return null;

  const shop = await prisma.shop.findUnique({
    where: { id: payload.shopId },
    select: { ...SHOP_PUBLIC_FIELDS, sessionsValidFrom: true },
  });
  if (!shop?.isActive) return null;
  if (shop.sessionsValidFrom && payload.iat < new Date(shop.sessionsValidFrom).getTime()) {
    return null;
  }

  const { sessionsValidFrom, ...rest } = shop;
  return serializeShop(rest);
});

// ── Attribution ─────────────────────────────────────────────────────────────

export function commissionOn(goodsTotal, rate) {
  return round2((Number(goodsTotal) * Number(rate)) / 100);
}

// Whether any of these contact details are, or used to be, the owner's. Past ones count
// because owners can change their own details.
export function sharesContact({ emails, phones }, shop) {
  const shopEmails = [shop.email, ...(shop.formerEmails ?? [])].map((email) => email.toLowerCase());
  const shopPhones = [shop.phone, ...(shop.formerPhones ?? [])];
  return (
    emails.filter(Boolean).some((email) => shopEmails.includes(String(email).trim().toLowerCase())) ||
    phones.filter(Boolean).some((phone) => shopPhones.includes(normalizePhone(phone)))
  );
}

export const OWNER_CONTACT_FIELDS = { email: true, phone: true, formerEmails: true, formerPhones: true };

/**
 * The share owed on a sale by this shop's referrer, or null if none is. A deactivated
 * referrer earns nothing new, the same as their own link.
 */
async function resolveReferrerShare(referrer) {
  if (!referrer?.isActive) return null;
  const rate = await getShopReferralRate();
  return rate > 0 ? { shopId: referrer.id, rate } : null;
}

/**
 * The shop this order should credit, from the cookie the buyer's link click left.
 *
 * Whoever buys through a link earns that shop its profit, and its referrer their share.
 * The buyer's details are deliberately not compared with the owners', so an owner buying
 * through their own link is paid too. That is the store owner's decision.
 *
 * Never throws: a problem crediting a partner must not stop a customer paying.
 *
 * @returns {Promise<{id: string, commissionRate: object, referrer: {shopId: string, rate: number}|null}|null>}
 */
export async function resolveAttributedShop() {
  try {
    const cookieStore = await cookies();
    const linkCode = cookieStore.get(SHOP_ATTRIBUTION_COOKIE)?.value;
    if (!isValidLinkCode(linkCode)) return null;

    const shop = await prisma.shop.findFirst({
      where: { linkCode, isActive: true },
      select: {
        id: true,
        commissionRate: true,
        referredBy: { select: { id: true, isActive: true } },
      },
    });
    if (!shop) return null;

    return {
      id: shop.id,
      commissionRate: shop.commissionRate,
      referrer: await resolveReferrerShare(shop.referredBy),
    };
  } catch (error) {
    console.error("[shop] Could not resolve attribution:", error?.message || error);
    return null;
  }
}

/**
 * The active shop a referral code entered on the join form belongs to, or null. A live
 * code always works, whatever its owner has changed about themselves. An applicant whose
 * details match the owner's may be the owner, which an admin decides when they review the
 * request, so that is reported rather than refused.
 *
 * @param {string} code  as typed
 * @param {{email: string, phone: string}} applicant
 * @returns {Promise<{id: string, ownerName: string, sameContact: boolean}|null>}
 */
export async function findReferrerShop(code, applicant) {
  const referralCode = normalizeShopCode(code);
  if (!isValidShopReferralCode(referralCode)) return null;

  const shop = await prisma.shop.findFirst({
    where: { referralCode, isActive: true },
    select: { id: true, ownerName: true, ...OWNER_CONTACT_FIELDS },
  });
  if (!shop) return null;

  return {
    id: shop.id,
    ownerName: shop.ownerName,
    sameContact: sharesContact({ emails: [applicant.email], phones: [applicant.phone] }, shop),
  };
}

// ── Figures ─────────────────────────────────────────────────────────────────

// A sale counts while its order is paid and standing. A checkout that was never
// paid and an order that was cancelled and refunded both fall out of this on their
// own, which is why nothing has to go back and adjust a ShopSale. The exception is a
// refund made in Stripe's own dashboard, which leaves the order as it was: see
// recordShopSaleRefund.
const COUNTED_ORDER = { paymentStatus: "PAID", status: { not: "CANCELLED" } };
const COUNTED_SALE = { refundedInFull: false, disputedAt: null, order: COUNTED_ORDER };

function saleStatus(sale, cutoff) {
  const { order } = sale;
  if (order.status === "CANCELLED" || order.paymentStatus !== "PAID") return "CANCELLED";
  if (sale.disputedAt) return "DISPUTED";
  if (sale.refundedInFull) return "REFUNDED";
  return order.createdAt <= cutoff ? "SETTLED" : "PENDING";
}

const netOf = (amount, taken) => round2(Number(amount ?? 0) - Number(taken ?? 0));

/**
 * Takes back profit on an order refunded in Stripe, in proportion to how much of the
 * order's total has gone back. The owner and their referrer lose the same share.
 *
 * If that profit has already been paid out, the owner's balance goes negative, and
 * their next earnings have to cover it before they can be paid again.
 *
 * Stripe reports the running total refunded, and can deliver events twice or out of
 * order. So this sets the figures rather than adding to them, and only ever upwards.
 *
 * @param {object} args
 * @param {string} args.orderId
 * @param {number} args.refundedAmount  everything refunded on the order so far
 */
export async function recordShopSaleRefund({ orderId, refundedAmount }) {
  const sale = await prisma.shopSale.findUnique({
    where: { orderId },
    select: {
      id: true,
      goodsTotal: true,
      commission: true,
      referrerCommission: true,
      order: { select: { total: true } },
    },
  });
  const orderTotal = Number(sale?.order.total ?? 0);
  if (!sale || orderTotal <= 0) return;

  const share = Math.min(Number(refundedAmount) / orderTotal, 1);
  const refundedGoods = round2(Number(sale.goodsTotal) * share);

  await prisma.shopSale.updateMany({
    where: { id: sale.id, refundedGoods: { lt: refundedGoods } },
    data: {
      refundedGoods,
      reversedCommission: round2(Number(sale.commission) * share),
      reversedReferrerCommission: round2(Number(sale.referrerCommission ?? 0) * share),
      refundedInFull: share >= 1,
    },
  });
}

const EMPTY_TOTALS = {
  orders: 0,
  sales: 0,
  commission: 0,
  referralProfit: 0,
  pending: 0,
  settled: 0,
  paidOut: 0,
  balance: 0,
};

/**
 * Money figures for a set of shops, as a Map keyed by shop id.
 *
 * Commission is "pending" until the order's cancellation window closes, because
 * until then it can still be refunded. Only settled commission is payable, so the
 * store never pays out on an order that then gets cancelled.
 *
 * `orders` and `sales` are the shop's own. `commission` and everything worked out from
 * it also include the referrer's share of sales by shops it referred, which follows
 * the same rules and is also shown alone as `referralProfit`.
 */
export async function getShopTotals(shopIds) {
  const cutoff = cancelWindowCutoff(await getCancelWindowHours());
  const scope = { shopId: { in: shopIds } };
  const referrerScope = { referrerShopId: { in: shopIds } };

  const settledSale = { ...COUNTED_SALE, order: { ...COUNTED_ORDER, createdAt: { lte: cutoff } } };

  const [counted, settled, referral, referralSettled, payouts] = await Promise.all([
    prisma.shopSale.groupBy({
      by: ["shopId"],
      where: { ...scope, ...COUNTED_SALE },
      _count: { _all: true },
      _sum: { goodsTotal: true, refundedGoods: true, commission: true, reversedCommission: true },
    }),
    prisma.shopSale.groupBy({
      by: ["shopId"],
      where: { ...scope, ...settledSale },
      _sum: { commission: true, reversedCommission: true },
    }),
    prisma.shopSale.groupBy({
      by: ["referrerShopId"],
      where: { ...referrerScope, ...COUNTED_SALE },
      _sum: { referrerCommission: true, reversedReferrerCommission: true },
    }),
    prisma.shopSale.groupBy({
      by: ["referrerShopId"],
      where: { ...referrerScope, ...settledSale },
      _sum: { referrerCommission: true, reversedReferrerCommission: true },
    }),
    prisma.shopPayout.groupBy({
      by: ["shopId"],
      where: scope,
      _sum: { amount: true },
    }),
  ]);

  const countedById = new Map(counted.map((row) => [row.shopId, row]));
  const settledById = new Map(settled.map((row) => [row.shopId, row]));
  const referralById = new Map(referral.map((row) => [row.referrerShopId, row]));
  const referralSettledById = new Map(referralSettled.map((row) => [row.referrerShopId, row]));
  const paidById = new Map(payouts.map((row) => [row.shopId, row]));

  return new Map(
    shopIds.map((id) => {
      const row = countedById.get(id);
      const referralSum = referralById.get(id)?._sum;
      const referralSettledSum = referralSettledById.get(id)?._sum;
      const settledSum = settledById.get(id)?._sum;
      const referralProfit = netOf(referralSum?.referrerCommission, referralSum?.reversedReferrerCommission);
      const commission = round2(netOf(row?._sum.commission, row?._sum.reversedCommission) + referralProfit);
      const settledAmount = round2(
        netOf(settledSum?.commission, settledSum?.reversedCommission) +
          netOf(referralSettledSum?.referrerCommission, referralSettledSum?.reversedReferrerCommission)
      );
      const paidOut = Number(paidById.get(id)?._sum.amount ?? 0);
      return [
        id,
        {
          ...EMPTY_TOTALS,
          orders: row?._count._all ?? 0,
          sales: netOf(row?._sum.goodsTotal, row?._sum.refundedGoods),
          commission,
          referralProfit,
          settled: settledAmount,
          pending: round2(commission - settledAmount),
          paidOut,
          balance: round2(settledAmount - paidOut),
        },
      ];
    })
  );
}

/**
 * Takes all the profit off a sale while a card dispute on it is open or lost, and puts it
 * back if the store wins. If that profit has already been paid out, the owner's balance
 * goes negative, the same as a refund.
 *
 * Stripe can deliver events out of order, so only a newer event than the last one counts.
 *
 * @param {object} args
 * @param {string} args.orderId
 * @param {boolean} args.lost  whether the store has lost, or may yet lose, the money
 * @param {Date} args.at  when Stripe raised this event
 */
export async function recordShopSaleDispute({ orderId, lost, at }) {
  await prisma.shopSale.updateMany({
    where: { orderId, OR: [{ disputeEventAt: null }, { disputeEventAt: { lt: at } }] },
    data: { disputedAt: lost ? at : null, disputeEventAt: at },
  });
}

// ── The report's period ─────────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;
const STORE_OFFSET_MS = STORE_UTC_OFFSET_HOURS * HOUR_MS;
const REPORT_PAGE_SIZE = 20;
const REPORT_WITHDRAWALS = 10;
// So an all-time chart of a new shop has a few months to read against, not one bar.
const MIN_ALL_TIME_MONTHS = 6;

// An instant moved forward by the store's offset, so its UTC parts read as Gulf time.
const toStoreClock = (date) => new Date(date.getTime() + STORE_OFFSET_MS);
const fromStoreClock = (date) => new Date(date.getTime() - STORE_OFFSET_MS);

/** Where a period starts, as a Gulf day: "today" turns over at midnight in Dubai. */
export function shopReportRangeStart(range, now = new Date()) {
  const clock = toStoreClock(now);
  const [year, month, day] = [clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate()];
  if (range === "today") return fromStoreClock(new Date(Date.UTC(year, month, day)));
  if (range === "7d") return fromStoreClock(new Date(Date.UTC(year, month, day - 6)));
  if (range === "month") return fromStoreClock(new Date(Date.UTC(year, month, 1)));
  return null;
}

function formatBucket(date, options) {
  return date.toLocaleDateString("en-AE", { ...options, timeZone: "UTC" });
}

function hourLabel(hour) {
  return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
}

// Every slot the chart should show, including those with no sales: a gap in the
// sales has to read as a gap, not be closed up.
function chartSlots(range, firstSale, now) {
  const clock = toStoreClock(now);
  const [year, month, day] = [clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate()];

  if (range === "today") {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: `h${hour}`,
      label: hourLabel(hour),
      longLabel: `${hourLabel(hour)} today`,
    }));
  }

  if (range === "all") {
    const first = firstSale ? toStoreClock(firstSale) : clock;
    const elapsed = (year - first.getUTCFullYear()) * 12 + month - first.getUTCMonth();
    const count = Math.max(elapsed + 1, MIN_ALL_TIME_MONTHS);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(Date.UTC(year, month - (count - 1 - index), 1));
      return {
        key: `m${date.getUTCFullYear()}-${date.getUTCMonth()}`,
        label: formatBucket(date, { month: "short", year: "2-digit" }),
        longLabel: formatBucket(date, { month: "long", year: "numeric" }),
      };
    });
  }

  const firstDay = range === "7d" ? Date.UTC(year, month, day - 6) : Date.UTC(year, month, 1);
  const count = range === "7d" ? 7 : new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(firstDay + index * 24 * HOUR_MS);
    return {
      key: `d${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`,
      label: formatBucket(date, { day: "numeric", month: "short" }),
      longLabel: formatBucket(date, { day: "numeric", month: "long", year: "numeric" }),
    };
  });
}

function chartKey(range, createdAt) {
  const clock = toStoreClock(createdAt);
  if (range === "today") return `h${clock.getUTCHours()}`;
  if (range === "all") return `m${clock.getUTCFullYear()}-${clock.getUTCMonth()}`;
  return `d${clock.getUTCFullYear()}-${clock.getUTCMonth()}-${clock.getUTCDate()}`;
}

function buildRevenueChart(range, rows, now) {
  const firstSale = rows.reduce(
    (earliest, row) => (!earliest || row.createdAt < earliest ? row.createdAt : earliest),
    null
  );
  const revenue = new Map();
  for (const row of rows) {
    const key = chartKey(range, row.createdAt);
    revenue.set(key, round2((revenue.get(key) ?? 0) + Number(row.goodsTotal)));
  }
  return chartSlots(range, firstSale, now).map((slot) => ({
    ...slot,
    value: revenue.get(slot.key) ?? 0,
  }));
}

const earnsNothing = (status) => ["CANCELLED", "REFUNDED", "DISPUTED"].includes(status);

function pageOf(total, requested) {
  const pageCount = Math.max(Math.ceil(total / REPORT_PAGE_SIZE), 1);
  const page = Math.min(requested, pageCount);
  return { page, pageCount, total, skip: (page - 1) * REPORT_PAGE_SIZE };
}

/**
 * Everything the shop's report shows. Plain numbers and strings throughout, so it
 * can cross into a client component.
 *
 * Holds nothing about the buyer. A partner sees what sold and what they earned, and
 * the customer's identity is none of that.
 *
 * Of other partners it holds only the names of the shops this one referred. A shop's own
 * sales never show what its referrer got. The purchase by purchase list of referral
 * earnings is left out unless asked for, which only the admin console does.
 *
 * `totals` is the partner's balance, so it always covers all time. Everything else
 * follows the chosen period, except payments, which are a record of the balance.
 *
 * @param {string} shopId
 * @param {object} [options]
 * @param {boolean} [options.showReferralEarnings]  the list of earnings, for the admin
 * @param {string} [options.range]  a key from SHOP_REPORT_RANGES
 * @param {number} [options.page]  page of the shop's sales
 * @param {number} [options.referralPage]  page of the referral earnings
 */
export async function getShopReport(
  shopId,
  { showReferralEarnings = false, range = "all", page = 1, referralPage = 1 } = {}
) {
  const now = new Date();
  const from = shopReportRangeStart(range, now);
  const inPeriod = from ? { createdAt: { gte: from } } : {};
  const listedOrder = { paymentStatus: { in: ["PAID", "REFUNDED"] } };

  const [totalsById, products, countedRows, referralSum, salesTotal, referralTotal, payouts, windowHours, referredShops, withdrawalMinimum, withdrawals] =
    await Promise.all([
      getShopTotals([shopId]),
      prisma.orderItem.groupBy({
        by: ["productName"],
        where: {
          order: { ...COUNTED_ORDER, shopSale: { is: { shopId, refundedInFull: false, disputedAt: null, ...inPeriod } } },
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: "desc" } },
      }),
      prisma.shopSale.findMany({
        where: { shopId, ...inPeriod, ...COUNTED_SALE },
        select: {
          createdAt: true,
          goodsTotal: true,
          refundedGoods: true,
          commission: true,
          reversedCommission: true,
        },
      }),
      prisma.shopSale.aggregate({
        where: { referrerShopId: shopId, ...inPeriod, ...COUNTED_SALE },
        _sum: { referrerCommission: true, reversedReferrerCommission: true },
      }),
      // REFUNDED so a sale that was cancelled shows as cancelled instead of quietly
      // vanishing from the partner's list. Unpaid checkouts are left out entirely.
      prisma.shopSale.count({ where: { shopId, ...inPeriod, order: listedOrder } }),
      showReferralEarnings
        ? prisma.shopSale.count({ where: { referrerShopId: shopId, ...inPeriod, order: listedOrder } })
        : 0,
      prisma.shopPayout.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, note: true, createdAt: true },
      }),
      getCancelWindowHours(),
      // Oldest first, so the list only ever grows at the end.
      prisma.shop.findMany({
        where: { referredByShopId: shopId },
        orderBy: { createdAt: "asc" },
        select: { id: true, ownerName: true },
      }),
      getShopWithdrawalMinimum(),
      // A request the owner took back leaves their list, and is told by a toast instead.
      prisma.shopWithdrawal.findMany({
        where: { shopId, status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        take: REPORT_WITHDRAWALS,
        select: { id: true, amount: true, status: true, createdAt: true },
      }),
    ]);

  const countedSales = countedRows.map((row) => ({
    createdAt: row.createdAt,
    goodsTotal: netOf(row.goodsTotal, row.refundedGoods),
    commission: netOf(row.commission, row.reversedCommission),
  }));

  // Counted first, so a page number left over from a longer list lands on the last
  // page there is instead of an empty one.
  const salesPage = pageOf(salesTotal, page);
  const referralsPage = pageOf(referralTotal, referralPage);

  const [sales, referralSales] = await Promise.all([
    prisma.shopSale.findMany({
      where: { shopId, ...inPeriod, order: listedOrder },
      orderBy: { createdAt: "desc" },
      skip: salesPage.skip,
      take: REPORT_PAGE_SIZE,
      select: {
        id: true,
        rate: true,
        goodsTotal: true,
        commission: true,
        refundedGoods: true,
        reversedCommission: true,
        refundedInFull: true,
        disputedAt: true,
        createdAt: true,
        order: {
          select: {
            orderNumber: true,
            paymentStatus: true,
            status: true,
            createdAt: true,
            items: { select: { productName: true, quantity: true } },
          },
        },
      },
    }),
    showReferralEarnings
      ? prisma.shopSale.findMany({
          where: { referrerShopId: shopId, ...inPeriod, order: listedOrder },
          orderBy: { createdAt: "desc" },
          skip: referralsPage.skip,
          take: REPORT_PAGE_SIZE,
          select: {
            id: true,
            shopId: true,
            referrerRate: true,
            referrerCommission: true,
            reversedReferrerCommission: true,
            refundedInFull: true,
            disputedAt: true,
            createdAt: true,
            order: { select: { paymentStatus: true, status: true, createdAt: true } },
          },
        })
      : [],
  ]);

  const cutoff = cancelWindowCutoff(windowHours);
  const referredNameById = new Map(referredShops.map((shop) => [shop.id, shop.ownerName]));
  const periodReferralProfit = netOf(
    referralSum._sum.referrerCommission,
    referralSum._sum.reversedReferrerCommission
  );
  const totals = totalsById.get(shopId) ?? EMPTY_TOTALS;

  return {
    range,
    totals,
    withdrawal: {
      minimum: withdrawalMinimum,
      canWithdraw: totals.balance > 0 && totals.balance >= withdrawalMinimum,
      requests: withdrawals.map((entry) => ({
        id: entry.id,
        amount: Number(entry.amount),
        status: entry.status,
        date: entry.createdAt.toISOString(),
      })),
    },
    period: {
      orders: countedSales.length,
      sales: round2(countedSales.reduce((sum, row) => sum + Number(row.goodsTotal), 0)),
      profit: round2(
        countedSales.reduce((sum, row) => sum + Number(row.commission), periodReferralProfit)
      ),
      referralProfit: periodReferralProfit,
    },
    revenueChart: buildRevenueChart(range, countedSales, now),
    unitsSold: products.reduce((sum, row) => sum + (row._sum.quantity ?? 0), 0),
    products: products.map((row) => ({
      name: row.productName,
      units: row._sum.quantity ?? 0,
      value: Number(row._sum.total ?? 0),
    })),
    // Names alone, with no ids, because this reaches the owner's browser.
    referredShopNames: referredShops.map((shop) => shop.ownerName),
    referralEarnings: showReferralEarnings
      ? referralSales.map((sale) => {
          const status = saleStatus(sale, cutoff);
          const reversed = Number(sale.reversedReferrerCommission);
          return {
            id: sale.id,
            shop: referredNameById.get(sale.shopId),
            date: sale.createdAt.toISOString(),
            rate: Number(sale.referrerRate),
            commission: earnsNothing(status) ? 0 : netOf(sale.referrerCommission, reversed),
            partlyRefunded: !earnsNothing(status) && reversed > 0,
            status,
          };
        })
      : null,
    referralsPage: { page: referralsPage.page, pageCount: referralsPage.pageCount, total: referralTotal },
    sales: sales.map((sale) => {
      const status = saleStatus(sale, cutoff);
      const refunded = Number(sale.refundedGoods);
      return {
        id: sale.id,
        orderNumber: sale.order.orderNumber,
        date: sale.createdAt.toISOString(),
        items: sale.order.items.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
        })),
        rate: Number(sale.rate),
        value: earnsNothing(status) ? Number(sale.goodsTotal) : netOf(sale.goodsTotal, refunded),
        commission: earnsNothing(status) ? 0 : netOf(sale.commission, sale.reversedCommission),
        partlyRefunded: !earnsNothing(status) && refunded > 0,
        status,
      };
    }),
    salesPage: { page: salesPage.page, pageCount: salesPage.pageCount, total: salesTotal },
    payouts: payouts.map((payout) => ({
      id: payout.id,
      amount: Number(payout.amount),
      note: payout.note,
      date: payout.createdAt.toISOString(),
    })),
  };
}
