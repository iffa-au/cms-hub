/**
 * Shared shape and labels for the admin distribution enquiry pages.
 *
 * The backend stores the form's fixed choices as slugs. These label maps must
 * match iffa-2026's `distribution-enquiry/data/form-options.ts`; an unknown slug
 * falls back to the slug itself rather than disappearing.
 */

type PopulatedRef = { _id: string; name: string };

export type DistributionEnquiryItem = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  role: string;
  website?: string;
  title: string;
  contentType: PopulatedRef | null;
  genreIds?: PopulatedRef[];
  country: PopulatedRef | null;
  language: PopulatedRef | null;
  runtimeMinutes: number;
  year: number;
  productionStatus: string;
  synopsis: string;
  festivals?: string;
  rights: string[];
  territories: string[];
  territoriesSold?: string;
  deliverables?: string[];
  screenerUrl: string;
  screenerPassword?: string;
  trailerUrl?: string;
  notes?: string;
  rightsConfirmed: boolean;
  createdAt?: string;
};

export const ROLE_LABELS: Record<string, string> = {
  producer: "Producer",
  director: "Director",
  "sales-agent": "Sales agent",
  "rights-holder": "Rights holder",
  other: "Other",
};

export const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  "post-production": "In post-production",
  production: "In production",
};

export const RIGHTS_LABELS: Record<string, string> = {
  theatrical: "Theatrical",
  tv: "TV / Broadcast",
  svod: "Streaming (SVOD)",
  tvod: "Rental & purchase (TVOD)",
  "non-theatrical": "Airline & non-theatrical",
  all: "All rights",
};

export const TERRITORY_LABELS: Record<string, string> = {
  worldwide: "Worldwide",
  anz: "Australia & New Zealand",
  asia: "Asia",
  mena: "Middle East & North Africa",
  europe: "Europe",
  "north-america": "North America",
  "latin-america": "Latin America",
  africa: "Sub-Saharan Africa",
};

export const DELIVERABLE_LABELS: Record<string, string> = {
  dcp: "DCP",
  prores: "ProRes master",
  "english-subtitles": "English subtitles",
  "me-track": "M&E track",
  trailer: "Trailer",
  "key-art": "Key art",
};

export function labelOf(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

export function labelsOf(map: Record<string, string>, values?: string[]): string[] {
  return (values ?? []).map((v) => labelOf(map, v));
}

export function formatDate(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Status and message from a failed `fetch-util` (axios) call. */
export function requestError(e: unknown): { status?: number; message?: string } {
  const err = e as { response?: { status?: number; data?: { message?: string } }; message?: string };
  return {
    status: err?.response?.status,
    message: err?.response?.data?.message || err?.message,
  };
}
