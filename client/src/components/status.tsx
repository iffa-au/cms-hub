import { cn } from "@/lib/utils";

/**
 * The one place colour carries meaning in this app.
 *
 * Every record is somewhere in a pipeline, so its state is the most useful
 * thing to encode structurally — it rides the left edge of the row rather than
 * needing a column of its own. Gold is reserved for NOMINATED and for actions,
 * which is what stops it reading as wallpaper the way it did when every title
 * and every label was gold.
 */
export type RecordStatus =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "NOMINATED"
  | "WINNER";

export const STATUS_LABEL: Record<RecordStatus, string> = {
  SUBMITTED: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  NOMINATED: "Nominated",
  WINNER: "Winner",
};

// Written out in full because Tailwind only sees class names it can read as
// literals — building these by interpolation would generate nothing.
const EDGE: Record<RecordStatus, string> = {
  SUBMITTED: "border-l-status-submitted",
  APPROVED: "border-l-status-approved",
  REJECTED: "border-l-status-rejected",
  NOMINATED: "border-l-status-nominated",
  WINNER: "border-l-status-nominated",
};

const BAR: Record<RecordStatus, string> = {
  SUBMITTED: "bg-status-submitted",
  APPROVED: "bg-status-approved",
  REJECTED: "bg-status-rejected",
  NOMINATED: "bg-status-nominated",
  WINNER: "bg-status-nominated",
};

const CHIP: Record<RecordStatus, string> = {
  SUBMITTED: "border-status-submitted/35 bg-status-submitted/10 text-status-submitted",
  APPROVED: "border-status-approved/35 bg-status-approved/10 text-status-approved",
  REJECTED: "border-status-rejected/35 bg-status-rejected/10 text-status-rejected",
  NOMINATED: "border-status-nominated/35 bg-status-nominated/10 text-status-nominated",
  WINNER: "border-status-nominated bg-status-nominated text-background",
};

export const statusEdge = (status?: RecordStatus) =>
  status ? EDGE[status] : "border-l-border";

export const statusBar = (status?: RecordStatus) =>
  status ? BAR[status] : "bg-border";

export function StatusChip({
  status,
  className,
}: {
  status: RecordStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        CHIP[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
