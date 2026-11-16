/**
 * Shared shapes and labels for the event guest list
 * (`/admin/event-registrations`). Mirrors
 * `backend/models/eventRegistration.model.ts`.
 */

export type AttendeeType = "influencer" | "media" | "audience";
export type RegistrationStatus = "pending" | "approved" | "waitlisted" | "declined";
export type PassType = "" | "general" | "vip" | "press" | "creator" | "guest";

export type EventRegistration = {
  _id: string;
  attendeeType: AttendeeType;
  fullName: string;
  email: string;
  phone: string;
  accessibilityNeeds?: string;
  comments?: string;
  consent: boolean;
  socialPlatform?: string;
  socialHandle?: string;
  contentNiche?: string;
  media?: {
    outlet?: string;
    mediaType?: string;
    roleTitle?: string;
    outletWebsite?: string;
    pressId?: string;
    editorName?: string;
    editorEmail?: string;
    editorPhone?: string;
    coveragePlan?: string;
    crewCount?: number;
  };
  guests?: number;
  status: RegistrationStatus;
  passType?: PassType;
  seatOrTable?: string;
  adminNotes?: string;
  checkedIn: boolean;
  checkedInAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const TYPE_LABEL: Record<AttendeeType, string> = {
  influencer: "Influencer",
  media: "Media / press",
  audience: "General audience",
};

export const STATUS_OPTIONS: { value: RegistrationStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "declined", label: "Declined" },
];

export const PASS_OPTIONS: { value: PassType; label: string }[] = [
  { value: "", label: "Not assigned" },
  { value: "general", label: "General admission" },
  { value: "vip", label: "VIP" },
  { value: "press", label: "Press" },
  { value: "creator", label: "Creator" },
  { value: "guest", label: "Guest of IFFA" },
];


export const MEDIA_TYPE_LABEL: Record<string, string> = {
  print: "Print",
  online: "Online / digital",
  television: "Television",
  radio: "Radio",
  podcast: "Podcast",
  photography: "Photography",
  agency: "News agency / wire",
  other: "Other",
};

export const STATUS_CHIP: Record<RegistrationStatus, string> = {
  pending: "border-status-submitted/35 bg-status-submitted/10 text-status-submitted",
  approved: "border-status-approved/35 bg-status-approved/10 text-status-approved",
  waitlisted: "border-status-nominated/35 bg-status-nominated/10 text-status-nominated",
  declined: "border-status-rejected/35 bg-status-rejected/10 text-status-rejected",
};

export const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  other: "Other",
};

/** Seats this registration takes: the registrant plus guests or crew. */
export function headcount(r: EventRegistration): number {
  if (r.attendeeType === "audience") return 1 + (r.guests ?? 0);
  if (r.attendeeType === "media") return 1 + (r.media?.crewCount ?? 0);
  return 1;
}

function csvCell(value: unknown): string {
  const s = value === undefined || value === null ? "" : String(value);
  // Leading = + - @ would run as a formula when the file opens in Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function registrationsToCsv(rows: EventRegistration[]): string {
  const header = [
    "Received",
    "Type",
    "Status",
    "Pass",
    "Seat / table",
    "Checked in",
    "Full name",
    "Email",
    "Phone",
    "Headcount",
    "Platform",
    "Username / link",
    "Content type",
    "Outlet",
    "Media type",
    "Role / title",
    "Outlet website",
    "Press ID",
    "Editor name",
    "Editor email",
    "Editor phone",
    "Crew",
    "Coverage plan",
    "Guests",
    "Access needs",
    "Comments",
    "Admin notes",
  ];
  const lines = rows.map((r) =>
    [
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
      TYPE_LABEL[r.attendeeType],
      r.status,
      r.passType,
      r.seatOrTable,
      r.checkedIn ? "yes" : "no",
      r.fullName,
      r.email,
      r.phone,
      headcount(r),
      r.socialPlatform ? PLATFORM_LABEL[r.socialPlatform] ?? r.socialPlatform : "",
      r.socialHandle,
      r.contentNiche,
      r.media?.outlet,
      r.media?.mediaType ? MEDIA_TYPE_LABEL[r.media.mediaType] ?? r.media.mediaType : "",
      r.media?.roleTitle,
      r.media?.outletWebsite,
      r.media?.pressId,
      r.media?.editorName,
      r.media?.editorEmail,
      r.media?.editorPhone,
      r.attendeeType === "media" ? r.media?.crewCount ?? 0 : "",
      r.media?.coveragePlan,
      r.attendeeType === "audience" ? r.guests ?? 0 : "",
      r.accessibilityNeeds,
      r.comments,
      r.adminNotes,
    ]
      .map(csvCell)
      .join(","),
  );
  // BOM so Excel reads names with accents correctly.
  return "﻿" + [header.join(","), ...lines].join("\r\n");
}
