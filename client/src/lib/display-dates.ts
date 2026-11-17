/**
 * Talent Lab dates are stored as the text visitors see ("29 Aug 2026",
 * "5 Oct – 13 Nov 2026", "Rolling"), because the public site prints them as
 * written and closes applications by reading the "Closes" text (iffa-2026
 * `talent-lab/lib/status.ts` `closingDay`). These helpers let the CMS offer
 * date pickers without changing that format.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthIndex = (name: string) => MONTHS.findIndex((m) => m.toLowerCase() === name.slice(0, 3).toLowerCase());
const pad = (n: number) => String(n).padStart(2, "0");

type Parts = { y: number; m: number; d: number };

const fromIso = (iso: string): Parts | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) } : null;
};
const toIso = ({ y, m, d }: Parts) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** "2026-08-29" → "29 Aug 2026". */
export function formatDisplayDate(iso: string): string {
  const p = fromIso(iso);
  return p ? `${p.d} ${MONTHS[p.m]} ${p.y}` : "";
}

/** "29 Aug 2026" → "2026-08-29"; anything else (e.g. "Rolling", "Feb 2027") → "". */
export function parseDisplayDate(text: string): string {
  const match = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\.?,?\s+(\d{4})$/.exec(text.trim());
  if (!match) return "";
  const m = monthIndex(match[2]);
  return m < 0 ? "" : toIso({ y: Number(match[3]), m, d: Number(match[1]) });
}

/**
 * Two picked days → the site's range text: "5 Oct – 13 Nov 2026", or with
 * both years when they differ: "5 Dec 2026 – 13 Jan 2027". One day alone is
 * shown as a single date.
 */
export function formatDisplayRange(startIso: string, endIso: string): string {
  const a = fromIso(startIso);
  const b = fromIso(endIso);
  if (a && !b) return formatDisplayDate(startIso);
  if (!a && b) return formatDisplayDate(endIso);
  if (!a || !b) return "";
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m]} – ${b.d} ${MONTHS[b.m]} ${b.y}`;
  return `${a.d} ${MONTHS[a.m]} ${a.y} – ${b.d} ${MONTHS[b.m]} ${b.y}`;
}

/** "5 Oct – 13 Nov 2026" (or "5 – 13 Nov 2026", or with two years) → ISO start and end; "" where unreadable. */
export function parseDisplayRange(text: string): { start: string; end: string } {
  const match =
    /^(\d{1,2})(?:\s+([A-Za-z]{3,}))?(?:\s+(\d{4}))?\s*[–—-]\s*(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(text.trim());
  if (!match) {
    const single = parseDisplayDate(text);
    return { start: single, end: "" };
  }
  const endMonth = monthIndex(match[5]);
  const endYear = Number(match[6]);
  const startMonth = match[2] ? monthIndex(match[2]) : endMonth;
  const startYear = match[3] ? Number(match[3]) : endYear;
  if (endMonth < 0 || startMonth < 0) return { start: "", end: "" };
  return {
    start: toIso({ y: startYear, m: startMonth, d: Number(match[1]) }),
    end: toIso({ y: endYear, m: endMonth, d: Number(match[4]) }),
  };
}
