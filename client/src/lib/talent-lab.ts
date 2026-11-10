/** Talent Lab inbox types and labels. Mirrors cms-hub backend talentLab models. */

export { formatDate, requestError } from "@/lib/distribution-enquiry";

export const APPLICATION_STATUSES = [
  "new",
  "reviewing",
  "shortlisted",
  "declined",
  "accepted",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  declined: "Declined",
  accepted: "Accepted",
};

export const APPLICATION_STATUS_CLASSES: Record<ApplicationStatus, string> = {
  new: "border-primary/60 text-primary",
  reviewing: "border-sky-400/50 text-sky-300",
  shortlisted: "border-amber-400/50 text-amber-300",
  declined: "border-white/20 text-muted-foreground",
  accepted: "border-emerald-400/50 text-emerald-300",
};

export type TalentLabApplication = {
  _id: string;
  reference: string;
  status: ApplicationStatus;
  staffNotes?: string;
  program: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  primaryDiscipline: string;
  secondaryDiscipline?: string;
  careerStage: string;
  biography?: string;
  careerObjective?: string;
  projectDescription?: string;
  whyThisProgram?: string;
  portfolioLink: string;
  availability: string;
  previousPrograms?: string;
  /** Sensitive: only on the single-record route. */
  accessRequirements?: string;
  firstNationsIdentification?: string;
  regionalRemote?: string;
  consents?: { terms: boolean; conduct: boolean; privacy: boolean; media: boolean };
  createdAt?: string;
};

export type TalentLabRegistration = {
  _id: string;
  fullName: string;
  email: string;
  state: string;
  discipline: string;
  careerStage: string;
  portfolioLink?: string;
  programs: string[];
  /** Sensitive: only on the single-record route. */
  accessRequirements?: string;
  mailingList: boolean;
  createdAt?: string;
};

/** A CSV cell, quoted so commas, quotes and line breaks survive. */
export const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
