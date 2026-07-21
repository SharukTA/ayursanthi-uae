// Wallet rules.
//
// Since the referral program moved to automatic payouts, the wallet is no longer the
// place people go to *ask* for their money — post-milestone commission is swept out
// to their bank account on its own (see lib/payouts.js). The manual withdrawal path
// below survives for the money auto-payout can't reach:
//
//   • balances that accrued before the user saved payout details, if they'd rather
//     be paid by hand than save a bank account;
//   • non-referral credit (voucher redemptions);
//   • anything an automatic payout failed to deliver and an admin must settle.
//
// It is gated on the same milestone that unlocks earnings in the first place, since
// a pre-milestone user has no referral money to withdraw by definition — their
// commission was retained by the company (see lib/referral.js).

// Smallest amount (in rupees) a user may request to withdraw in one request.
export const MIN_WITHDRAWAL_AMOUNT = 100;
