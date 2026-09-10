import { Schema, model } from "mongoose";

/**
 * Everything on the Festivals page that is not a festival: the hero, the award
 * spotlight, the closing call to action, and the months announced as coming
 * without a programme.
 *
 * The `about` section — eyebrow, heading, body paragraphs, banner and stats —
 * was removed along with the statement section that rendered it. Stored copies
 * are cleared by `scripts/drop-festival-settings-about.ts`.
 *
 * The venue band went the same way: `venues`, `planTitle`, `planBody`, `city`
 * and `country` are gone from the schema, the controller and the CMS form. A
 * venue belongs to the screening that happens there — it is already edited on
 * every screening and shown on the site's screening and film pages — so the
 * festival-wide list was a second place to keep the same fact in step. Stored
 * copies are cleared by `scripts/drop-festival-settings-venue-band.ts`.
 *
 * A singleton — there is one Festivals page. Read paths never create it (see
 * `readFestivalSettings`); every field carries a schema default so a database
 * with no settings document still renders a complete, correct page.
 *
 * Coming-soon months are stored, not derived: the months holding published
 * festivals are simply a fact, but "October — coming soon" is someone choosing
 * to promise it. Deriving it would mean guessing how far ahead to commit.
 *
 * MONGOOSE TRAP (see AGENTS.md): a field declared only on the TypeScript
 * interface is silently dropped on save. Every field below appears in BOTH the
 * interface and the Schema object.
 */

export interface IComingSoonMonth {
  year: number;
  /** 1-12. */
  month: number;
  note?: string;
}

export interface ILinkedCta {
  label: string;
  href: string;
}

export interface IHeroSection {
  eyebrow: string;
  title: string;
  subtitle: string;
  /**
   * Full-bleed background. Defaults to the banner shipped in the site repo, so
   * the page is never image-less; an upload replaces it.
   */
  backgroundImageUrl: string;
  /** S3 key, set only when the image was uploaded through the CMS. */
  backgroundImageKey: string;
  primaryCta: ILinkedCta;
  secondaryCta: ILinkedCta;
}

export interface IAwardSection {
  eyebrow: string;
  heading: string;
  body: string;
  imageUrl: string;
  imageKey: string;
  /** Short lines listed beside the trophy. */
  points: string[];
}

export interface ICtaSection {
  eyebrow: string;
  heading: string;
  body: string;
  primaryCta: ILinkedCta;
  secondaryCta: ILinkedCta;
}

export interface IFestivalSettings {
  seriesLabel: string;
  comingSoonMonths: IComingSoonMonth[];
  hero: IHeroSection;
  award: IAwardSection;
  cta: ICtaSection;
  /** Heading above the month-by-month schedule. */
  scheduleEyebrow: string;
  scheduleHeading: string;
  scheduleIntro: string;
}

const comingSoonMonthSchema = new Schema<IComingSoonMonth>(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    note: { type: String, default: "", trim: true, maxLength: 1000 },
  },
  { _id: true },
);

const ctaSchema = new Schema<ILinkedCta>(
  {
    label: { type: String, default: "", trim: true, maxLength: 80 },
    href: { type: String, default: "", trim: true, maxLength: 500 },
  },
  { _id: false },
);

const heroSchema = new Schema<IHeroSection>(
  {
    eyebrow: { type: String, default: "International Film Festival of Australia", trim: true, maxLength: 200 },
    title: { type: String, default: "Where the world's cinema meets Australia", trim: true, maxLength: 300 },
    subtitle: {
      type: String,
      default:
        "Two festivals a month, curated from across the world and screened in Melbourne. Discover the films, the nights and the filmmakers coming next.",
      trim: true,
      maxLength: 1000,
    },
    // Ships with the site repo; an upload replaces it.
    backgroundImageUrl: { type: String, default: "/assets/iffa big banner.jpg", trim: true },
    backgroundImageKey: { type: String, default: "", trim: true },
    primaryCta: { type: ctaSchema, default: () => ({ label: "Explore Festivals", href: "#schedule" }) },
    secondaryCta: { type: ctaSchema, default: () => ({ label: "Submit Your Film", href: "/submit-film" }) },
  },
  { _id: false },
);

const awardSchema = new Schema<IAwardSection>(
  {
    eyebrow: { type: String, default: "The IFFA Award", trim: true, maxLength: 200 },
    heading: { type: String, default: "Recognition that travels further than the screening", trim: true, maxLength: 300 },
    body: {
      type: String,
      default:
        "The IFFA Award is presented across every competitive category of the festival year. Judged by a rotating international jury of filmmakers, programmers and critics, it is awarded on the work alone — not on budget, country or reputation.",
      trim: true,
      maxLength: 4000,
    },
    imageUrl: { type: String, default: "/assets/logos/iffa-award.png", trim: true },
    imageKey: { type: String, default: "", trim: true },
    points: {
      type: [String],
      default: [
        "Judged by an international jury, rotated every season",
        "Open to every film in competition, at no additional cost",
        "Winners announced at the closing night of each festival",
      ],
    },
  },
  { _id: false },
);

const ctaSectionSchema = new Schema<ICtaSection>(
  {
    eyebrow: { type: String, default: "Join us", trim: true, maxLength: 200 },
    heading: { type: String, default: "Be in the room when the lights go down", trim: true, maxLength: 300 },
    body: {
      type: String,
      default:
        "Tickets open closer to each festival weekend. Register now and we will let you know the moment the schedule you are watching goes on sale.",
      trim: true,
      maxLength: 2000,
    },
    primaryCta: { type: ctaSchema, default: () => ({ label: "Register Interest", href: "/submit-film-enquiry" }) },
    secondaryCta: { type: ctaSchema, default: () => ({ label: "Contact the Team", href: "/contact" }) },
  },
  { _id: false },
);

const festivalSettingsSchema = new Schema<IFestivalSettings>(
  {
    // Nothing on the public page has rendered `seriesLabel` for some time and
    // the CMS has no input for it. Kept on the schema so no stored document
    // needs migrating; delete it here if that ever stops being worth the row.
    seriesLabel: { type: String, default: "Festival Series 2026", trim: true, maxLength: 200 },
    scheduleEyebrow: { type: String, default: "What's on", trim: true, maxLength: 200 },
    scheduleHeading: { type: String, default: "Upcoming festivals", trim: true, maxLength: 300 },
    scheduleIntro: {
      type: String,
      default:
        "Discover upcoming festivals and explore the films screening throughout each festival.",
      trim: true,
      maxLength: 1000,
    },
    comingSoonMonths: { type: [comingSoonMonthSchema], default: [] },
    hero: { type: heroSchema, default: () => ({}) },
    award: { type: awardSchema, default: () => ({}) },
    cta: { type: ctaSectionSchema, default: () => ({}) },
  },
  { timestamps: true },
);

const FestivalSettings = model("FestivalSettings", festivalSettingsSchema);
export default FestivalSettings;
