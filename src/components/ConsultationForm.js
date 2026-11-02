"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { Check, CheckCircle2, ChevronDown, MessageCircle, Phone, RotateCcw, Send } from "lucide-react";
import { useSiteSettings } from "@/components/SettingsProvider";
import { Button } from "@/components/ui/button";
import {
  CONSULTATION_SECTIONS,
  buildConsultationMessages,
  detailId,
  detailVisible,
  formProblems,
  groupFieldsVisible,
  groupVisible,
  localDateString,
  sectionLines,
  startingValues,
  whatsappUrl,
} from "@/lib/consultation";

// Every section with a required field starts open, so nobody has to discover at
// submit time that the last section needed filling in.
const DEFAULT_OPEN_SECTIONS = CONSULTATION_SECTIONS.filter((section) =>
  section.fields?.some((field) => field.required)
).map((section) => section.id);

const INPUT =
  "min-h-11 w-full rounded-md border border-input bg-white px-4 text-sm font-normal text-[#0f1111] outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10";

const INVALID = "border-[#b12704]";

function Label({ field, error }) {
  return (
    <>
      {field.label}
      {field.required ? <span className="text-[#b12704]"> *</span> : null}
      {error ? <span className="ml-2 text-xs font-normal text-[#b12704]">{error}</span> : null}
    </>
  );
}

function Options({ field, value, onChange }) {
  const multi = field.type === "multi";
  const selected = multi ? (Array.isArray(value) ? value : []) : value;

  return (
    <div className="flex flex-wrap gap-2">
      {field.options.map((option) => {
        const checked = multi ? selected.includes(option) : selected === option;
        return (
          <label
            key={option}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm font-normal text-[#0f1111] transition hover:bg-[#f7fafa] has-checked:border-[#156c6b] has-checked:bg-[#e8f3f3]"
          >
            <input
              type={multi ? "checkbox" : "radio"}
              name={field.id}
              checked={checked}
              // A radio can't normally be un-chosen, and every optional question
              // here should be leave-blank-able after a mis-tap.
              onClick={() => {
                if (!multi && checked) onChange(field.id, "");
              }}
              onChange={() => {
                if (!multi) onChange(field.id, option);
                else onChange(field.id, checked ? selected.filter((o) => o !== option) : [...selected, option]);
              }}
              className="size-4 shrink-0 accent-[#156c6b]"
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}

function Field({ field, values, onChange, error, today }) {
  const value = values[field.id] ?? "";
  const domId = `consult-${field.id}`;

  if (field.type === "choice" || field.type === "multi") {
    return (
      // tabIndex so a failed submit can move focus straight to the group.
      <fieldset id={domId} tabIndex={-1} className="grid gap-2 outline-none">
        <legend className="mb-2 text-sm font-semibold text-[#0f1111]">
          <Label field={field} error={error} />
        </legend>
        <Options field={field} value={value} onChange={onChange} />
        {detailVisible(field, values) ? (
          <label className="grid gap-1 text-xs font-semibold text-[#565959]">
            {field.detail.label}
            <input
              type="text"
              maxLength={500}
              value={values[detailId(field)] ?? ""}
              onChange={(e) => onChange(detailId(field), e.target.value)}
              className={INPUT}
            />
          </label>
        ) : null}
      </fieldset>
    );
  }

  return (
    <label htmlFor={domId} className="grid gap-2 text-sm font-semibold text-[#0f1111]">
      <span>
        <Label field={field} error={error} />
      </span>
      {field.type === "textarea" ? (
        <textarea
          id={domId}
          rows={3}
          maxLength={1500}
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          className={`${INPUT} resize-y py-3 ${error ? INVALID : ""}`}
        />
      ) : (
        <input
          id={domId}
          type={field.type === "date" ? "date" : "text"}
          maxLength={500}
          min={field.notPast && today ? today : undefined}
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          className={`${INPUT} ${error ? INVALID : ""}`}
        />
      )}
    </label>
  );
}

function FieldList({ fields, values, onChange, errors, today }) {
  return (
    <div className="grid gap-5">
      {fields.map((field) => (
        <Field
          key={field.id}
          field={field}
          values={values}
          onChange={onChange}
          error={errors[field.id]}
          today={today}
        />
      ))}
    </div>
  );
}

function Group({ group, values, onChange, errors, today }) {
  return (
    <div className="rounded-md border border-[#e0e3e3] p-4">
      {group.gate ? (
        <Field field={group.gate} values={values} onChange={onChange} />
      ) : (
        <h3 className="text-sm font-bold text-[#0f1111]">{group.title}</h3>
      )}
      {groupFieldsVisible(group, values) ? (
        <div className="mt-4">
          <FieldList fields={group.fields} values={values} onChange={onChange} errors={errors} today={today} />
        </div>
      ) : null}
    </div>
  );
}

// Collapsed sections render nothing, which is also what keeps typing responsive:
// the form holds about 300 inputs and all their values live in one state object.
function Section({ section, values, onChange, errors, today, incomplete, open, onToggle }) {
  // `incomplete` matters for the declaration: its date fills itself in, which must
  // not earn the section a tick before the client has actually signed.
  const answered = !incomplete && sectionLines(section, values).length > 0;
  const panelId = `consult-section-${section.id}`;

  return (
    <section className="rounded-md border border-border bg-white shadow-sm">
      <h2>
        <button
          type="button"
          onClick={() => onToggle(section.id)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-bold text-[#0f1111] sm:px-5"
        >
          <span className="min-w-0 flex-1">
            {section.id}. {section.title}
          </span>
          {answered ? <CheckCircle2 aria-label="Answered" className="size-5 shrink-0 text-[#156c6b]" /> : null}
          <ChevronDown className={`size-5 shrink-0 text-[#565959] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </h2>
      {open ? (
        <div id={panelId} className="grid gap-5 border-t border-[#e0e3e3] px-4 py-5 sm:px-5">
          {section.note ? <p className="text-sm text-[#565959]">{section.note}</p> : null}
          {section.fields ? (
            <FieldList fields={section.fields} values={values} onChange={onChange} errors={errors} today={today} />
          ) : null}
          {section.groups
            ?.filter((group) => groupVisible(group, values))
            .map((group) => (
              <Group key={group.id} group={group} values={values} onChange={onChange} errors={errors} today={today} />
            ))}
        </div>
      ) : null}
    </section>
  );
}

// Shown once the form is submitted. WhatsApp only ever receives what the client
// sends from their own app, so this has to say so plainly — closing WhatsApp
// without pressing Send means the clinic gets nothing.
function SendPanel({ number, parts, opened, onOpened, onReset, panelRef }) {
  const single = parts.length === 1;

  return (
    <div ref={panelRef} className="scroll-mt-4 rounded-md border border-border bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-[#0f1111]">One last step: press Send in WhatsApp</h2>
      <p className="mt-2 text-sm text-[#3f4545]">
        {single
          ? "WhatsApp should have opened with your details filled in. We only receive them after you press Send there. If it did not open, use the button below. Your answers have been cleared from this page, so this button stops working if you reload or leave it."
          : `Your answers are long, so they have been split into ${parts.length} WhatsApp messages. Open each one in turn and press Send. We need all of them to see your full history. Your answers have been cleared from this page, so keep it open until every message is sent.`}
      </p>

      <div className="mt-5 grid gap-3">
        {parts.map((part, i) => (
          <Button key={i} asChild className="h-11 rounded-md bg-emerald-700 hover:bg-emerald-800">
            <a
              href={whatsappUrl(number, part)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpened(i)}
            >
              {opened.includes(i) ? <Check className="size-4" /> : <MessageCircle className="size-4" />}
              {single ? "Open WhatsApp" : `Message ${i + 1} of ${parts.length}`}
              {opened.includes(i) ? " (opened)" : ""}
            </a>
          </Button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
        <button type="button" onClick={onReset} className="flex items-center gap-1.5 text-[#007185] hover:underline">
          <RotateCcw className="size-4" /> Start a new form
        </button>
      </div>
    </div>
  );
}

export function ConsultationForm() {
  const { consultation_whatsapp: number } = useSiteSettings();
  // Answers are medical, so they live in this state and nowhere else: a reload or
  // leaving the page ends them, and a shared computer keeps nothing for the next
  // person.
  const [values, setValues] = useState({});
  // The finished messages, once submitted. All that is left of the answers by
  // then, and held in memory only, so a reload or leaving the page ends them too.
  const [parts, setParts] = useState(null);
  const [opened, setOpened] = useState([]);
  const [openSections, setOpenSections] = useState(DEFAULT_OPEN_SECTIONS);
  const [attempted, setAttempted] = useState(false);
  // Empty until mounted: the server's date can differ from the client's, and
  // rendering it would be a hydration mismatch.
  const [today, setToday] = useState("");
  const panelRef = useRef(null);

  useEffect(() => {
    const now = localDateString();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(now);
    setValues(startingValues(now));
  }, []);

  // Going back to this page from another site can restore it from the browser's
  // back/forward cache, state and all, without React mounting anything anew.
  useEffect(() => {
    const clearRestoredPage = (e) => {
      if (!e.persisted) return;
      const now = localDateString();
      setToday(now);
      setValues(startingValues(now));
      setParts(null);
      setOpened([]);
      setAttempted(false);
      setOpenSections(DEFAULT_OPEN_SECTIONS);
    };
    window.addEventListener("pageshow", clearRestoredPage);
    return () => window.removeEventListener("pageshow", clearRestoredPage);
  }, []);

  const setField = (id, value) => setValues((prev) => ({ ...prev, [id]: value }));

  const toggleSection = (id) =>
    setOpenSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const markOpened = (index) =>
    setOpened((prev) => (prev.includes(index) ? prev : [...prev, index]));

  const problems = formProblems(values, today);
  const errors = attempted ? Object.fromEntries(problems.map((p) => [p.fieldId, p.message])) : {};

  const handleSubmit = (e) => {
    e.preventDefault();

    // Today is read afresh: a form left open overnight must not pass yesterday's
    // date as today's.
    const now = localDateString();
    const blocking = formProblems(values, now);

    if (blocking.length) {
      setAttempted(true);
      // flushSync so a required field in a collapsed section is in the DOM by
      // the time it is focused.
      flushSync(() => {
        setToday(now);
        setOpenSections((prev) => [...new Set([...prev, ...blocking.map((p) => p.sectionId)])]);
      });
      document.getElementById(`consult-${blocking[0].fieldId}`)?.focus();
      toast.error(`Please check: ${blocking.map((p) => `${p.label} (${p.message.toLowerCase()})`).join(", ")}.`);
      return;
    }

    const messages = buildConsultationMessages(values, new Date().toLocaleDateString("en-GB"));

    // Only a single message opens by itself: browsers allow one new tab per
    // click, so several have to be one tap each. Called straight from the click
    // for the same reason — any later and it counts as a blocked pop-up. The
    // panel's button covers the case where it is blocked anyway.
    if (messages.length === 1) window.open(whatsappUrl(number, messages[0]), "_blank", "noopener,noreferrer");

    flushSync(() => {
      setParts(messages);
      setOpened(messages.length === 1 ? [0] : []);
      setToday(now);
      setValues(startingValues(now));
      setAttempted(false);
      setOpenSections(DEFAULT_OPEN_SECTIONS);
    });
    panelRef.current?.scrollIntoView({ block: "start" });
  };

  const handleReset = () => {
    const now = localDateString();
    setToday(now);
    setValues(startingValues(now));
    setParts(null);
    setOpened([]);
  };

  // Enter in a one-line box must not submit: on a form this long it would launch
  // WhatsApp with half the answers still to come.
  const blockEnterSubmit = (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault();
  };

  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {parts ? (
        <SendPanel
          number={number}
          parts={parts}
          opened={opened}
          onOpened={markOpened}
          onReset={handleReset}
          panelRef={panelRef}
        />
      ) : (
        // autoComplete off: medical answers should not come back as browser
        // suggestions for the next person on a shared computer, and it also stops
        // browsers refilling the boxes themselves after a reload.
        <form onSubmit={handleSubmit} onKeyDown={blockEnterSubmit} noValidate autoComplete="off" className="grid gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#0f1111]">Ayurshanti Beauty Clinic – Client Case History Form</h2>
            <p className="mt-2 text-sm text-[#3f4545]">
              Confidential client record. Fields marked <span className="text-[#b12704]">*</span> are required. The
              rest are optional, but the more you answer, the better we can advise you. Tap a section to open it.
              For your privacy, your answers are cleared if you reload or leave this page, so please complete the form
              in one go.
            </p>
          </div>

          {CONSULTATION_SECTIONS.map((section) => (
            <Section
              key={section.id}
              section={section}
              values={values}
              onChange={setField}
              errors={errors}
              today={today}
              incomplete={problems.some((p) => p.sectionId === section.id)}
              open={openSections.includes(section.id)}
              onToggle={toggleSection}
            />
          ))}

          <Button type="submit" className="mt-2 h-12 rounded-md bg-emerald-700 text-base hover:bg-emerald-800">
            Send to consultation
            <Send className="size-4" />
          </Button>
          <p className="text-xs text-[#565959]">
            Your answers are not saved on our website. Submitting opens WhatsApp on your own phone or computer with
            your details filled in, ready for you to press Send.
          </p>
        </form>
      )}

      <div className="mt-8 rounded-md border border-border bg-white p-5 text-center shadow-sm">
        <h2 className="text-sm font-bold text-[#0f1111]">Consult this number for online consultation</h2>
        <p className="mt-2 text-xl font-bold text-[#0f1111]">{number}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold">
          <a
            href={whatsappUrl(number)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[#007185] hover:underline"
          >
            <MessageCircle className="size-4" /> Chat on WhatsApp
          </a>
          <a
            href={`tel:+${String(number ?? "").replace(/\D/g, "")}`}
            className="flex items-center gap-1.5 text-[#007185] hover:underline"
          >
            <Phone className="size-4" /> Call
          </a>
        </div>
      </div>
    </section>
  );
}
