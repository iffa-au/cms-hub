/**
 * Field descriptions for the staff-editable Talent Lab content. One entry per
 * kind drives both the list page and the edit form under /talent-lab/<kind>.
 *
 * Vocabularies mirror cms-hub backend `models/talentLabContent.model.ts`, which
 * mirrors iffa-2026 `talent-lab/lib/types.ts`. Keep all three in step.
 */

export type ContentKind = "events" | "opportunities" | "mentors";

export type ContentField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "tags" | "url";
  options?: readonly string[];
  /** Labels for select values, when the stored value isn't readable. */
  optionLabels?: Record<string, string>;
  help?: string;
  placeholder?: string;
};

export type ContentKindConfig = {
  kind: ContentKind;
  singular: string;
  plural: string;
  description: string;
  /** Unique key the public site links by. */
  keyField: "slug" | "id";
  keyHelp: string;
  titleField: string;
  subtitle: (item: ContentItem) => string;
  /** Public page where the content appears, for staff to check their edit. */
  siteHref: string;
  fields: ContentField[];
};

export type ContentItem = {
  _id: string;
  order: number;
  isPublished: boolean;
  [field: string]: unknown;
};

const DISCIPLINES = ["Directing", "Producing", "Writing", "Acting", "Documentary", "Crew"] as const;

export const CONTENT_KINDS: Record<ContentKind, ContentKindConfig> = {
  events: {
    kind: "events",
    singular: "Event",
    plural: "Events",
    description: "Talent Lab masterclasses and sessions shown on /talent-lab/events and the Talent Lab home page.",
    keyField: "slug",
    keyHelp: "Used in the page address: /talent-lab/events/<slug>. Lowercase words joined by hyphens.",
    titleField: "title",
    subtitle: (e) => `${e.when} · ${e.state === "past" ? "Past" : "Upcoming"}`,
    siteHref: "/talent-lab/events",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "when", label: "When", type: "text", placeholder: "Thu 20 Aug 2026 · 6:00–7:30pm AEST", help: "Shown exactly as written." },
      { key: "state", label: "Upcoming or past", type: "select", options: ["upcoming", "past"], optionLabels: { upcoming: "Upcoming", past: "Past" } },
      { key: "format", label: "Format", type: "text", placeholder: "Online masterclass" },
      { key: "mode", label: "Where", type: "text", placeholder: "Online (Zoom) or Melbourne — venue TBC" },
      { key: "speakerName", label: "Speaker name", type: "text" },
      { key: "speakerRole", label: "Speaker role", type: "text", placeholder: "Producer" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "registerHref", label: "Registration link", type: "url", help: "Optional. Leave empty and the Register button shows as unavailable." },
    ],
  },
  opportunities: {
    kind: "opportunities",
    singular: "Opportunity",
    plural: "Opportunities",
    description: "Program intakes and open calls shown on /talent-lab/opportunities, the Talent Lab home page and each program's page.",
    keyField: "id",
    keyHelp: "A short unique id, lowercase words joined by hyphens. Not shown to visitors.",
    titleField: "title",
    subtitle: (o) => `${o.cycle} · ${String(o.status)}`,
    siteHref: "/talent-lab/opportunities",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "streamSlug", label: "Program", type: "text", placeholder: "emerging-filmmakers-lab", help: "The program's slug (from its page address /talent-lab/programs/<slug>). Powers the Program details button." },
      { key: "summary", label: "Summary", type: "textarea" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["eoi", "opening-soon", "open", "closing-soon", "closed", "in-progress", "completed"],
        optionLabels: {
          eoi: "Expressions of interest",
          "opening-soon": "Opening soon",
          open: "Open",
          "closing-soon": "Closing soon",
          closed: "Closed",
          "in-progress": "In progress",
          completed: "Completed",
        },
      },
      { key: "ctaLabel", label: "Button label", type: "text", placeholder: "Apply now" },
      { key: "opensOn", label: "Opens", type: "text", placeholder: "1 Jul 2026 or Rolling" },
      { key: "closesOn", label: "Closes", type: "text", placeholder: "30 Aug 2026" },
      { key: "programDates", label: "Program dates", type: "text", placeholder: "5 Oct – 13 Nov 2026" },
      { key: "cycle", label: "Cycle", type: "text", placeholder: "Cycle Two 2026 or Year-round" },
      { key: "discipline", label: "Discipline (filter)", type: "select", options: DISCIPLINES },
      { key: "stage", label: "Career stage (filter)", type: "select", options: ["Emerging", "Early career"] },
      { key: "deliveryMode", label: "Delivery (filter)", type: "select", options: ["Online", "Hybrid", "In person"] },
      { key: "modeLabel", label: "Delivery, as shown", type: "text", placeholder: "Online + Melbourne intensive" },
      { key: "tags", label: "Tags", type: "tags", help: "Comma-separated, e.g. Directing, Writing" },
    ],
  },
  mentors: {
    kind: "mentors",
    singular: "Mentor",
    plural: "Mentors",
    description: "Practitioners shown on /talent-lab/mentors, the Talent Lab home page and program pages.",
    keyField: "slug",
    keyHelp: "A short unique id, lowercase words joined by hyphens, e.g. jane-citizen. Programs refer to mentors by it.",
    titleField: "name",
    subtitle: (m) => `${m.role} · ${m.organisation} · ${m.type}`,
    siteHref: "/talent-lab/mentors",
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "role", label: "Role", type: "text", placeholder: "Director" },
      { key: "organisation", label: "Organisation", type: "text", placeholder: "Freelance" },
      { key: "country", label: "Country", type: "text" },
      { key: "type", label: "Type", type: "select", options: ["Confirmed Mentor", "Past Guest", "Partner"] },
      { key: "discipline", label: "Discipline", type: "select", options: DISCIPLINES },
      { key: "year", label: "Year", type: "text", placeholder: "2026" },
      { key: "bio", label: "Bio", type: "textarea" },
    ],
  },
};

export const isContentKind = (value: unknown): value is ContentKind =>
  value === "events" || value === "opportunities" || value === "mentors";
