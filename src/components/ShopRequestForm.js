"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { PhoneField } from "@/components/PhoneField";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { SHOP_TIERS } from "@/lib/shop-shared";
import { validateEmail, validateMobile, validateName } from "@/lib/validation";

const FIELD =
  "min-h-11 w-full rounded border bg-white px-3 text-sm font-normal outline-none transition focus:border-emerald-700";
const LABEL = "grid gap-2 text-sm font-semibold text-slate-800";

// The rules a field can be checked against before anything is sent. The API applies
// the same ones, and also the checks only the database can answer.
const VALIDATORS = {
  ownerName: validateName,
  phone: validateMobile,
  email: validateEmail,
};

function fieldBorder(error) {
  return error ? "border-rose-600" : "border-input";
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <span id={id} role="alert" className="text-xs font-medium text-rose-700">
      {message}
    </span>
  );
}

/** The public form at /join-shop. There is no shop code here: the admin sets it. */
export function ShopRequestForm() {
  const [form, setForm] = useState({
    ownerName: "",
    phone: "",
    email: "",
    investmentAed: String(SHOP_TIERS[0].investmentAed),
    referralCode: "",
    website: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const setField = (key) => (event) => updateField(key, event.target.value);

  const checkField = (key) => () => {
    // A blank field is only an error once they try to send the form.
    if (!form[key].trim()) return;
    setErrors((prev) => ({ ...prev, [key]: VALIDATORS[key](form[key]) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError("");

    const found = Object.fromEntries(
      Object.entries(VALIDATORS).map(([key, validate]) => [key, validate(form[key])])
    );
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/shop/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSent(true);
      } else if (data.field) {
        setErrors((prev) => ({ ...prev, [data.field]: data.message }));
      } else {
        setFormError(data.message || "Could not send your request.");
      }
    } catch {
      setFormError("Could not send your request. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="py-4 text-center" role="status">
        <CheckCircle2 className="mx-auto size-10" style={{ color: "#156c6b" }} aria-hidden="true" />
        <h2 className="mt-3 text-lg font-bold text-slate-950">Request sent</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Thank you. We will contact you soon. Once you are approved, your shop code will be sent
          to {form.email}.
        </p>
      </div>
    );
  }

  return (
    // noValidate so every problem appears the same way, beside its field.
    <form onSubmit={submit} noValidate className="grid gap-4">
      <label className={LABEL}>
        Full name *
        <input
          type="text"
          autoComplete="name"
          value={form.ownerName}
          onChange={setField("ownerName")}
          onBlur={checkField("ownerName")}
          aria-invalid={errors.ownerName ? "true" : undefined}
          aria-describedby={errors.ownerName ? "join-name-error" : undefined}
          className={`${FIELD} ${fieldBorder(errors.ownerName)}`}
        />
        <FieldError id="join-name-error" message={errors.ownerName} />
      </label>
      {/* Not wrapped in a label: PhoneField holds the country button as well as the
          input, and a wrapping label would open the country list on any click. */}
      <div className={LABEL}>
        <label htmlFor="join-phone">Mobile number *</label>
        <div onBlur={checkField("phone")}>
          <PhoneField
            id="join-phone"
            name="phone"
            value={form.phone}
            onChange={(value) => updateField("phone", value)}
            defaultCountry="AE"
            error={Boolean(errors.phone)}
            placeholder="Mobile number"
            borderClassName="border-input"
            className="min-h-11 w-full bg-white focus-within:border-emerald-700"
            inputClassName="px-3 text-sm font-normal"
          />
        </div>
        <FieldError id="join-phone-error" message={errors.phone} />
      </div>
      <label className={LABEL}>
        Email *
        <input
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={setField("email")}
          onBlur={checkField("email")}
          aria-invalid={errors.email ? "true" : undefined}
          aria-describedby={errors.email ? "join-email-error" : undefined}
          className={`${FIELD} ${fieldBorder(errors.email)}`}
        />
        <FieldError id="join-email-error" message={errors.email} />
      </label>
      <label className={LABEL}>
        Investment *
        <select
          value={form.investmentAed}
          onChange={setField("investmentAed")}
          className={`${FIELD} ${fieldBorder(errors.investmentAed)}`}
        >
          {SHOP_TIERS.map((tier) => (
            <option key={tier.investmentAed} value={tier.investmentAed}>
              {formatMoney(tier.investmentAed, { decimals: 0 })}: {tier.commissionRate}% profit on sales
            </option>
          ))}
        </select>
        <FieldError id="join-investment-error" message={errors.investmentAed} />
      </label>
      <label className={LABEL}>
        Shop referral code (optional)
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={form.referralCode}
          onChange={setField("referralCode")}
          aria-invalid={errors.referralCode ? "true" : undefined}
          aria-describedby={errors.referralCode ? "join-referral-error" : undefined}
          className={`${FIELD} ${fieldBorder(errors.referralCode)} font-mono uppercase`}
        />
        <span className="text-xs font-normal text-slate-500">
          If a shop owner invited you, enter their code here.
        </span>
        <FieldError id="join-referral-error" message={errors.referralCode} />
      </label>

      {/* Hidden from people, so only a bot fills it in. See /api/shop/requests. */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={setField("website")}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {formError ? (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={submitting}
        className="h-11 rounded-md bg-emerald-700 text-sm font-semibold hover:bg-emerald-800"
      >
        {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
        Send request
      </Button>
    </form>
  );
}
