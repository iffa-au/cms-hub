import {
  APPLICATION_STATUS_CLASSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/talent-lab";

export default function TalentLabStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${APPLICATION_STATUS_CLASSES[status] ?? ""}`}
    >
      {APPLICATION_STATUS_LABELS[status] ?? status}
    </span>
  );
}
