"use client";

import { inputClass } from "@/components/form-section";
import { cn } from "@/lib/utils";

/**
 * Which days the Chatbot insights page shows: quick choices (today, last 7 /
 * 30 / 90 days) or any custom range. Dates are whole days in the admin's own
 * time zone; `periodParams` turns them into exact start / end times for the API.
 */

export type Preset = "today" | "7" | "30" | "90" | "custom";
export type Period = { preset: Preset; from: string; to: string }; // from / to: YYYY-MM-DD

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "custom", label: "Custom" },
];

/** YYYY-MM-DD for a date in the admin's time zone (not UTC). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

/** The period for a quick choice; "custom" keeps the dates it is given. */
export function presetPeriod(preset: Preset, current?: Period): Period {
  const today = ymd(new Date());
  if (preset === "today") return { preset, from: today, to: today };
  if (preset === "custom") return { preset, from: current?.from ?? daysAgo(6), to: current?.to ?? today };
  return { preset, from: daysAgo(Number(preset) - 1), to: today };
}

/** from / to as exact times: the start of the first day and the end of the last. */
export function periodParams(period: Period): { from: string; to: string } {
  return {
    from: new Date(`${period.from}T00:00:00`).toISOString(),
    to: new Date(`${period.to}T23:59:59.999`).toISOString(),
  };
}

const tab = (active: boolean) =>
  cn(
    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
    active ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
  );

export default function PeriodPicker({
  period,
  onChange,
  retentionDays = 90,
}: {
  period: Period;
  onChange: (period: Period) => void;
  /** Questions older than this are deleted, so earlier dates can't be picked. */
  retentionDays?: number;
}) {
  const today = ymd(new Date());
  const oldest = daysAgo(retentionDays);

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div role="tablist" aria-label="Period" className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            role="tab"
            aria-selected={period.preset === p.value}
            onClick={() => onChange(presetPeriod(p.value, period))}
            className={tab(period.preset === p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period.preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            From
            <input
              type="date"
              value={period.from}
              min={oldest}
              max={period.to}
              onChange={(e) => e.target.value && onChange({ ...period, from: e.target.value })}
              className={cn(inputClass, "h-9 w-auto py-0")}
            />
          </label>
          <label className="flex items-center gap-2">
            To
            <input
              type="date"
              value={period.to}
              min={period.from}
              max={today}
              onChange={(e) => e.target.value && onChange({ ...period, to: e.target.value })}
              className={cn(inputClass, "h-9 w-auto py-0")}
            />
          </label>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Questions are kept for {retentionDays} days.</p>
    </div>
  );
}
