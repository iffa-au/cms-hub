import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The card that groups a run of fields, and the field wrapper inside it.
 *
 * Seven pages each declared their own `INPUT` and `LABEL` constants with the
 * same hardcoded hexes (`#0a0a0a`, `#393528`, `#544e3b`) — values that already
 * exist as tokens. They also used `p-8` at every width, which spends half a
 * phone screen on padding.
 */
export function FormSection({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-border bg-surface-dark", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </div>
      <div className="grid grid-cols-1 gap-5 p-4 sm:gap-6 sm:p-6 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

/**
 * A labelled control. `span` lets a field claim the full width of the
 * two-column grid — synopsis and notes want that, a release year doesn't.
 */
export function Field({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  span = false,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  span?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-2", span && "md:col-span-2", className)}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-primary">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-status-rejected" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const labelClass = "block text-xs font-medium text-label";

export const inputClass =
  "w-full rounded border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-[var(--placeholder)] focus:border-border-focus disabled:opacity-70";

export const textareaClass = cn(inputClass, "resize-y min-h-24");
