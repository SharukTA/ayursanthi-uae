"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PhoneField } from "@/components/PhoneField";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { buildShopLink, SHOP_TIERS } from "@/lib/shop-shared";

const subscribeToNothing = () => () => {};

/** The form at /my-shop. On success the page reloads as the shop itself. */
export function ShopCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/shop/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not open your shop.");
      setCode("");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-2 text-sm font-semibold text-slate-800">
        Shop code
        <input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="min-h-11 w-full rounded border border-input bg-white px-3 font-mono text-sm font-normal uppercase outline-none transition focus:border-emerald-700"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={submitting || !code.trim()}
        className="h-11 rounded-md bg-emerald-700 text-sm font-semibold hover:bg-emerald-800"
      >
        {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
        View my shop
      </Button>
    </form>
  );
}

/**
 * The partner's advert link, to the home page or any product. Only the browser knows
 * the public origin, and the server's first render must match, hence the empty
 * snapshot until hydration.
 */
export function ShopLinkCard({ linkCode, products }) {
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => ""
  );
  const [path, setPath] = useState("/");
  const [copied, setCopied] = useState(false);
  const link = origin ? buildShopLink(origin, path, linkCode) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy automatically. Please select and copy it manually.");
    }
  };

  return (
    <section className="rounded-md border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">Your link for ads</h2>
      <p className="mt-1 text-[13px] leading-5 text-slate-600">
        Use this link in your ads. You earn on purchases made within 30 days of someone
        clicking it. Share the link only: your shop code stays private.
      </p>
      <label className="mt-4 grid gap-2 text-xs font-semibold text-slate-800">
        Page to link to
        <select
          value={path}
          onChange={(event) => setPath(event.target.value)}
          className="min-h-10 w-full min-w-0 rounded border border-input bg-white px-3 text-sm font-normal outline-none transition focus:border-emerald-700"
        >
          <option value="/">Home page</option>
          {products.map((product) => (
            <option key={product.slug} value={`/products/${product.slug}`}>
              {product.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          readOnly
          value={link}
          aria-label="Your link"
          className="min-h-10 w-full min-w-0 flex-1 rounded border border-input bg-slate-50 px-3 font-mono text-xs outline-none"
        />
        <Button
          type="button"
          onClick={copy}
          disabled={!link}
          className="h-10 rounded-md bg-emerald-700 text-xs font-semibold hover:bg-emerald-800"
        >
          {copied ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
          Copy link
        </Button>
      </div>
    </section>
  );
}

/** The code a partner gives to people joining, and what it earns them. */
export function ShopReferralCard({ referralCode, referralRate }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Referral code copied.");
    } catch {
      toast.error("Could not copy automatically. Please select and copy it manually.");
    }
  };

  return (
    <section className="rounded-md border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">Your shop referral code</h2>
      <p className="mt-1 text-[13px] leading-5 text-slate-600">
        Give this to people joining the business partnership. They enter it on the join form,
        and once they are approved you earn {referralRate}% of every purchase made through
        their link. This is not your shop code and cannot open your shop.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="min-w-0 flex-1 break-all rounded border border-input bg-slate-50 px-3 py-2 font-mono text-sm font-bold text-slate-950">
          {referralCode}
        </span>
        <Button
          type="button"
          onClick={copy}
          className="h-10 rounded-md bg-emerald-700 text-xs font-semibold hover:bg-emerald-800"
        >
          {copied ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
          Copy code
        </Button>
      </div>
    </section>
  );
}

const DETAIL_FIELD =
  "min-h-10 w-full min-w-0 rounded border border-input bg-white px-3 text-sm font-normal outline-none transition focus:border-emerald-700";
const DETAIL_LABEL = "grid gap-2 text-xs font-semibold text-slate-800";

async function sendDetails(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 font-semibold text-slate-900 wrap-break-word">{value}</dd>
    </div>
  );
}

/**
 * The owner's own name, mobile and email. Only they can change these. Every change asks
 * for the shop code again, and an email change also needs a code sent to the new address.
 * A new investment is only a request, which changes nothing until an admin approves it.
 */
export function ShopDetailsCard({
  ownerName,
  phone,
  email,
  pendingEmail,
  investmentAed,
  commissionRate,
  latestInvestmentChange,
}) {
  const router = useRouter();
  const [mode, setMode] = useState("view");
  const [draft, setDraft] = useState({ ownerName, phone, newEmail: "", code: "", otp: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newInvestment, setNewInvestment] = useState("");
  const waitingFor = mode === "view" ? pendingEmail : null;
  const otherTiers = SHOP_TIERS.filter((tier) => tier.investmentAed !== investmentAed);
  const investmentWaiting = latestInvestmentChange?.status === "PENDING";

  const setField = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  const open = (nextMode) => {
    setDraft({ ownerName, phone, newEmail: "", code: "", otp: "" });
    setError("");
    setMode(nextMode);
  };

  const run = async (task, onDone) => {
    setBusy(true);
    setError("");
    try {
      await task();
      onDone();
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shopCodeField = (
    <label className={DETAIL_LABEL}>
      Your shop code
      <input
        type="text"
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={draft.code}
        onChange={setField("code")}
        className={`${DETAIL_FIELD} font-mono uppercase`}
      />
    </label>
  );

  const errorLine = error ? (
    <p role="alert" className="text-xs font-medium text-rose-700">
      {error}
    </p>
  ) : null;

  const secondaryButton =
    "h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  const primaryButton = "h-10 rounded-md bg-emerald-700 text-xs font-semibold hover:bg-emerald-800";
  const spinner = busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null;
  const showOtp = mode === "otp" || (mode === "view" && waitingFor);

  return (
    <section className="rounded-md border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">Your details</h2>

      {mode === "view" || mode === "otp" ? (
        <dl className="mt-2 divide-y divide-slate-100">
          <DetailRow label="Name" value={ownerName} />
          <DetailRow label="Mobile number" value={phone} />
          <DetailRow label="Email" value={email} />
          <DetailRow
            label="Investment"
            value={`${formatMoney(investmentAed, { decimals: 0 })}, ${commissionRate}% profit`}
          />
        </dl>
      ) : null}

      {mode === "view" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => open("details")} className={secondaryButton}>
            Edit name and mobile
          </button>
          <button type="button" onClick={() => open("email")} className={secondaryButton}>
            Change email
          </button>
          {investmentWaiting ? null : (
            <button type="button" onClick={() => open("investment")} className={secondaryButton}>
              Change investment
            </button>
          )}
        </div>
      ) : null}

      {mode === "view" && investmentWaiting ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-[13px] leading-5 text-slate-700">
            You asked to change your investment to{" "}
            <span className="font-bold">
              {formatMoney(latestInvestmentChange.amount, { decimals: 0 })}
            </span>
            . Your current investment and profit stay the same unless we approve it.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => sendDetails("/api/shop/investment", "DELETE"),
                () => toast.success("Your investment request was cancelled.")
              )
            }
            className="text-xs font-semibold text-rose-700 underline disabled:opacity-50"
          >
            Cancel request
          </button>
        </div>
      ) : null}

      {mode === "view" && latestInvestmentChange?.status === "DECLINED" ? (
        <p className="mt-3 text-[13px] leading-5 text-slate-600">
          Your request to change your investment to{" "}
          {formatMoney(latestInvestmentChange.amount, { decimals: 0 })} was declined, so it stays
          as it is.
        </p>
      ) : null}

      {mode === "view" && error ? errorLine : null}

      {mode === "investment" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => sendDetails("/api/shop/investment", "POST", {
                investmentAed: newInvestment || otherTiers[0].investmentAed,
                code: draft.code,
              }),
              () => {
                setMode("view");
                toast.success("Your request was sent.");
              }
            );
          }}
          className="mt-3 grid gap-3"
        >
          <p className="text-[13px] leading-5 text-slate-600">
            We will contact you about this request. Your investment and profit stay the same
            unless we approve it, and a new profit rate applies to new purchases only.
          </p>
          <label className={DETAIL_LABEL}>
            New investment
            <select
              value={newInvestment || otherTiers[0].investmentAed}
              onChange={(event) => setNewInvestment(event.target.value)}
              className={DETAIL_FIELD}
            >
              {otherTiers.map((tier) => (
                <option key={tier.investmentAed} value={tier.investmentAed}>
                  {formatMoney(tier.investmentAed, { decimals: 0 })}: {tier.commissionRate}% profit
                </option>
              ))}
            </select>
          </label>
          {shopCodeField}
          {errorLine}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} className={primaryButton}>
              {spinner}
              Send request
            </Button>
            <button type="button" onClick={() => open("view")} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {mode === "details" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => sendDetails("/api/shop/profile", "PATCH", {
                ownerName: draft.ownerName,
                phone: draft.phone,
                code: draft.code,
              }),
              () => {
                setMode("view");
                toast.success("Your details were saved.");
              }
            );
          }}
          className="mt-3 grid gap-3"
        >
          <label className={DETAIL_LABEL}>
            Name
            <input type="text" required value={draft.ownerName} onChange={setField("ownerName")} className={DETAIL_FIELD} />
          </label>
          {/* Not wrapped in a label: PhoneField holds a button as well as the input. */}
          <div className={DETAIL_LABEL}>
            <label htmlFor="shop-owner-phone">Mobile number</label>
            <PhoneField
              id="shop-owner-phone"
              value={draft.phone}
              onChange={(value) => setDraft((prev) => ({ ...prev, phone: value }))}
              defaultCountry="AE"
              placeholder="Mobile number"
              borderClassName="border-input"
              className="min-h-10 w-full bg-white"
              inputClassName="px-3 text-sm font-normal"
            />
          </div>
          {shopCodeField}
          {errorLine}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} className={primaryButton}>
              {spinner}
              Save
            </Button>
            <button type="button" onClick={() => open("view")} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {mode === "email" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => sendDetails("/api/shop/profile/email", "POST", { newEmail: draft.newEmail, code: draft.code }),
              () => {
                setDraft((prev) => ({ ...prev, code: "", otp: "" }));
                setMode("otp");
              }
            );
          }}
          className="mt-3 grid gap-3"
        >
          <p className="text-[13px] leading-5 text-slate-600">
            This is how we contact you, so we will send a code to the new address to check it.
            Your current email ({email}) stays until you confirm.
          </p>
          <label className={DETAIL_LABEL}>
            New email
            <input type="email" required value={draft.newEmail} onChange={setField("newEmail")} className={DETAIL_FIELD} />
          </label>
          {shopCodeField}
          {errorLine}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} className={primaryButton}>
              {spinner}
              Send code
            </Button>
            <button type="button" onClick={() => open("view")} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {showOtp ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => sendDetails("/api/shop/profile/email/confirm", "POST", { otp: draft.otp }),
              () => {
                setDraft((prev) => ({ ...prev, otp: "" }));
                setMode("done");
              }
            );
          }}
          className="mt-3 grid gap-3 rounded border border-amber-200 bg-amber-50 p-3"
        >
          <p className="text-[13px] leading-5 text-slate-700">
            We sent a code to {pendingEmail ?? draft.newEmail}. Enter it within 10 minutes to
            finish changing your email.
          </p>
          <label className={DETAIL_LABEL}>
            Code from the email
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={draft.otp}
              onChange={setField("otp")}
              className={`${DETAIL_FIELD} font-mono`}
            />
          </label>
          {errorLine}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} className={primaryButton}>
              {spinner}
              Confirm new email
            </Button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => sendDetails("/api/shop/profile/email", "DELETE"), () => open("view"))}
              className={secondaryButton}
            >
              Cancel change
            </button>
          </div>
        </form>
      ) : null}

      {mode === "done" ? (
        <div className="mt-2" role="status">
          <dl className="divide-y divide-slate-100">
            <DetailRow label="Name" value={ownerName} />
            <DetailRow label="Mobile number" value={phone} />
            <DetailRow label="Email" value={email} />
          <DetailRow
            label="Investment"
            value={`${formatMoney(investmentAed, { decimals: 0 })}, ${commissionRate}% profit`}
          />
          </dl>
          <p className="mt-2 text-[13px] leading-5 text-slate-700">
            Your email was changed. Your shop code stays the same.
          </p>
          <button type="button" onClick={() => open("view")} className={`mt-2 ${secondaryButton}`}>
            Done
          </button>
        </div>
      ) : null}
    </section>
  );
}

const WITHDRAWAL_STATUS = {
  PENDING: "Waiting",
  PAID: "Paid",
  DECLINED: "Declined",
};

function formatRequestDate(value) {
  return new Date(value).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Dubai",
  });
}

/** Asking to be paid, and what has happened to earlier requests. */
export function ShopWithdrawalCard({ available, withdrawal }) {
  const router = useRouter();
  const pending = withdrawal.requests.find((entry) => entry.status === "PENDING");
  const history = withdrawal.requests.filter((entry) => entry.status !== "PENDING");
  // Null means they have not changed it, so it follows the balance when that moves.
  const [typed, setTyped] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (method, body) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/withdrawals", {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
      setTyped(null);
      setCode("");
      if (method === "DELETE") toast.success("Your withdrawal request was cancelled.");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!pending && !withdrawal.canWithdraw && history.length === 0) return null;

  const amount = typed ?? available.toFixed(2);

  return (
    <div className="mt-3 rounded-md border border-border bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-950">Withdraw your profit</h3>

      {pending ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] leading-5 text-slate-600">
            You asked to withdraw{" "}
            <span className="font-bold text-slate-900">{formatMoney(pending.amount)}</span> on{" "}
            {formatRequestDate(pending.date)}. We will send it to your bank account and it will
            then appear under Payments.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => call("DELETE")}
            className="text-xs font-semibold text-rose-700 underline disabled:opacity-50"
          >
            Cancel request
          </button>
        </div>
      ) : withdrawal.canWithdraw ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            call("POST", { amount, code });
          }}
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <label className="grid gap-2 text-xs font-semibold text-slate-800">
            Amount to withdraw (up to {formatMoney(available)})
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              max={available}
              required
              value={amount}
              onChange={(event) => setTyped(event.target.value)}
              className="min-h-10 w-full min-w-0 rounded border border-input bg-white px-3 text-sm font-normal outline-none transition focus:border-emerald-700"
            />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-slate-800">
            Your shop code
            <input
              type="text"
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="min-h-10 w-full min-w-0 rounded border border-input bg-white px-3 font-mono text-sm font-normal uppercase outline-none transition focus:border-emerald-700"
            />
          </label>
          <Button
            type="submit"
            disabled={busy}
            className="h-10 rounded-md bg-emerald-700 text-xs font-semibold hover:bg-emerald-800"
          >
            {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Request withdrawal
          </Button>
        </form>
      ) : (
        <p className="mt-2 text-[13px] text-slate-600">
          You can request a withdrawal once you reach {formatMoney(withdrawal.minimum)} available.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}

      {history.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-xs text-slate-600">
          {history.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                {formatRequestDate(entry.date)} &middot; {formatMoney(entry.amount)}
              </span>
              <span className="font-semibold text-slate-800">{WITHDRAWAL_STATUS[entry.status]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ShopSignOutButton() {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/shop/session", { method: "DELETE" });
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={signOut}
      className="text-sm font-semibold text-white underline underline-offset-2"
    >
      Leave my shop
    </button>
  );
}
