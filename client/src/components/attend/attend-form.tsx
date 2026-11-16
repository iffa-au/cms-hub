"use client";

import { useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Field, FormSection, inputClass, textareaClass } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import { postData } from "@/lib/fetch-util";
import { cn } from "@/lib/utils";
import {
  ATTENDEE_TYPES,
  CREW_OPTIONS,
  EMPTY_VALUES,
  GUEST_OPTIONS,
  MEDIA_TYPES,
  PLATFORMS,
  attendSchema,
  toPayload,
  type AttendValues,
} from "@/lib/attend-form";

/**
 * The public awards-night registration form. The one CMS page that needs no
 * login (see PUBLIC_PATHS in route-guard.tsx), so admins can send its link to
 * creators, press and audience members. It only POSTs; the guest list stays
 * behind /admin/event-registrations.
 */
export default function AttendForm() {
  const [doneFor, setDoneFor] = useState<{ name: string; email: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<AttendValues>({
    resolver: zodResolver(attendSchema),
    defaultValues: EMPTY_VALUES,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const [type, platform] = useWatch({ control, name: ["attendeeType", "socialPlatform"] });
  const platformMeta = PLATFORMS.find((p) => p.value === platform) ?? PLATFORMS[0];

  const err = (name: keyof AttendValues) => errors[name]?.message ?? null;
  const invalid = (name: keyof AttendValues) => (errors[name] ? true : undefined);

  const onSubmit = async (values: AttendValues, event?: React.BaseSyntheticEvent) => {
    setSubmitting(true);
    setSubmitError(null);
    const formEl = (event as FormEvent<HTMLFormElement> | undefined)?.target;
    const homepage =
      formEl instanceof HTMLFormElement ? String(new FormData(formEl).get("homepage") ?? "") : "";
    try {
      await postData("/event-registrations", { ...toPayload(values), homepage });
      setDoneFor({ name: values.fullName, email: values.email });
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setSubmitError(
        typeof msg === "string" && msg
          ? msg
          : "We couldn't send your registration. Check your connection and try again — your answers are still here.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onInvalid = () => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    });
  };

  if (doneFor) {
    return (
      <main
        role="status"
        className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-20 text-center"
      >
        <CheckCircle2 aria-hidden className="mb-6 size-14 text-primary" />
        <h1 className="mb-3 font-serif text-3xl text-foreground">Request received</h1>
        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          Thanks, <span className="text-foreground">{doneFor.name.split(" ")[0]}</span>. The
          IFFA team reviews every request and will email{" "}
          <span className="text-foreground">{doneFor.email}</span> to confirm your place.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            reset(EMPTY_VALUES);
            setDoneFor(null);
          }}
        >
          Register someone else
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary/80">
          IFFA Awards 2026 · Awards night
        </p>
        <h1 className="mt-3 text-balance font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          Request your seat at the <span className="text-primary">awards night</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Tell us who you are and we&apos;ll be in touch to confirm. Fields marked{" "}
          <span className="text-primary">*</span> are required.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-5">
        {/* Honeypot — hidden from people and screen readers. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Leave this empty
            <input type="text" name="homepage" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <FormSection title="About you">
          <Field label="I'm attending as" htmlFor="attendeeType" required span>
            <select
              id="attendeeType"
              {...register("attendeeType", {
                onChange: () => {
                  // Errors from the other type's fields would otherwise linger.
                  clearErrors();
                  setSubmitError(null);
                },
              })}
              className={cn(inputClass, "h-11 cursor-pointer")}
            >
              {ATTENDEE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Full name" htmlFor="fullName" required span error={err("fullName")}>
            <input id="fullName" autoComplete="name" aria-invalid={invalid("fullName")} {...register("fullName")} className={inputClass} />
          </Field>
          <Field label="Contact number" htmlFor="phone" required error={err("phone")}>
            <input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+61 400 000 000" aria-invalid={invalid("phone")} {...register("phone")} className={inputClass} />
          </Field>
          <Field label="Email" htmlFor="email" required error={err("email")}>
            <input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" aria-invalid={invalid("email")} {...register("email")} className={inputClass} />
          </Field>
        </FormSection>

        {type === "influencer" && (
          <FormSection title="Your social media">
            <Field
              label="Social media"
              htmlFor="socialHandle"
              required
              span
              error={err("socialHandle")}
              hint={
                platform === "other"
                  ? "Name the platform and add your username or profile link."
                  : `Your ${platformMeta.label} username or profile link.`
              }
            >
              {/* Platform and username share one field: pick the platform on
                  the left, type the handle beside it. */}
              <div
                className={cn(
                  "flex overflow-hidden rounded border bg-background focus-within:border-border-focus",
                  errors.socialHandle ? "border-status-rejected" : "border-border",
                )}
              >
                <select
                  aria-label="Platform"
                  value={platform}
                  onChange={(e) => setValue("socialPlatform", e.target.value)}
                  className="w-32 shrink-0 cursor-pointer border-r border-border bg-surface-overlay px-3 text-sm font-medium text-primary outline-none sm:w-36"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input
                  id="socialHandle"
                  placeholder={platformMeta.placeholder}
                  aria-invalid={invalid("socialHandle")}
                  {...register("socialHandle")}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-[var(--placeholder)]"
                />
              </div>
            </Field>
            <Field label="What type of content do you make?" htmlFor="contentNiche" span error={err("contentNiche")}>
              <input id="contentNiche" placeholder="Film reviews, lifestyle, comedy, travel…" {...register("contentNiche")} className={inputClass} />
            </Field>
          </FormSection>
        )}

        {type === "media" && (
          <FormSection
            title="Your outlet"
            description="The publication or channel you're covering the night for, and who we can contact there."
          >
            <Field label="Media outlet" htmlFor="outlet" required error={err("outlet")}>
              <input id="outlet" placeholder="e.g. SBS, The Guardian, Film Ink" aria-invalid={invalid("outlet")} {...register("outlet")} className={inputClass} />
            </Field>
            <Field label="Media type" htmlFor="mediaType" required error={err("mediaType")}>
              <select id="mediaType" aria-invalid={invalid("mediaType")} {...register("mediaType")} className={cn(inputClass, "h-11 cursor-pointer")}>
                <option value="">Choose one</option>
                {MEDIA_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Your role" htmlFor="roleTitle" required error={err("roleTitle")}>
              <input id="roleTitle" placeholder="Journalist, critic, photographer…" aria-invalid={invalid("roleTitle")} {...register("roleTitle")} className={inputClass} />
            </Field>
            <Field label="Crew with you" htmlFor="crewCount">
              <select id="crewCount" {...register("crewCount")} className={cn(inputClass, "h-11 cursor-pointer")}>
                {CREW_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Editor / desk contact" htmlFor="editorName" required error={err("editorName")}>
              <input id="editorName" aria-invalid={invalid("editorName")} {...register("editorName")} className={inputClass} />
            </Field>
            <Field label="Editor / desk email" htmlFor="editorEmail" required error={err("editorEmail")}>
              <input id="editorEmail" type="email" inputMode="email" aria-invalid={invalid("editorEmail")} {...register("editorEmail")} className={inputClass} />
            </Field>
            <Field label="Editor / desk phone" htmlFor="editorPhone">
              <input id="editorPhone" type="tel" inputMode="tel" {...register("editorPhone")} className={inputClass} />
            </Field>
            <Field label="Press card / ID" htmlFor="pressId">
              <input id="pressId" placeholder="If you have one" {...register("pressId")} className={inputClass} />
            </Field>
            <Field label="Outlet website" htmlFor="outletWebsite" span>
              <input id="outletWebsite" inputMode="url" placeholder="https://" {...register("outletWebsite")} className={inputClass} />
            </Field>
            <Field label="What you plan to cover" htmlFor="coveragePlan" span error={err("coveragePlan")}>
              <textarea id="coveragePlan" rows={3} placeholder="Red carpet interviews, a review, a photo gallery…" {...register("coveragePlan")} className={textareaClass} />
            </Field>
          </FormSection>
        )}

        {type === "audience" && (
          <FormSection title="Your party">
            <Field label="Seats" htmlFor="guests" required>
              <select id="guests" {...register("guests")} className={cn(inputClass, "h-11 cursor-pointer")}>
                {GUEST_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </FormSection>
        )}

        <FormSection title="Anything else">
          <Field label="Access needs" htmlFor="accessibilityNeeds" span error={err("accessibilityNeeds")}>
            <input id="accessibilityNeeds" placeholder="Wheelchair access, hearing loop, dietary needs…" {...register("accessibilityNeeds")} className={inputClass} />
          </Field>
          <Field label="Comments" htmlFor="comments" span error={err("comments")}>
            <textarea id="comments" rows={3} placeholder="Anything you'd like the IFFA team to know" {...register("comments")} className={textareaClass} />
          </Field>
        </FormSection>

        <div>
          <label
            htmlFor="consent"
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border bg-surface-dark p-4 text-sm leading-relaxed text-foreground/85",
              errors.consent ? "border-status-rejected" : "border-border",
            )}
          >
            <input
              id="consent"
              type="checkbox"
              aria-invalid={invalid("consent")}
              {...register("consent")}
              className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
            />
            <span>
              My details are correct, and IFFA may contact me about this event. Registering is
              a request — a place is confirmed only by email from IFFA.
              <span aria-hidden className="ml-0.5 text-primary">*</span>
            </span>
          </label>
          {errors.consent && (
            <p className="mt-2 text-xs text-status-rejected" role="alert">
              {errors.consent.message}
            </p>
          )}
        </div>

        {submitError && (
          <p role="alert" className="rounded-lg border border-status-rejected/40 bg-status-rejected/10 px-4 py-3 text-sm text-status-rejected">
            {submitError}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" disabled={submitting} className="h-12 px-10 text-sm font-semibold">
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            {submitting ? "Sending…" : "Submit registration"}
          </Button>
          <p className="text-xs text-muted-foreground sm:max-w-[16rem] sm:text-right">
            Your details go only to the IFFA team. The guest list is never shown publicly.
          </p>
        </div>
      </form>
    </main>
  );
}
