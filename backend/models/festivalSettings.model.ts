import { Schema, model } from "mongoose";

/**
 * Everything on the Festivals page that is not a festival: the hero, the
 * intro, the award spotlight, the closing call to action, the venue list, and
 * the months announced as coming without a programme.
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

export interface IFestivalVenue {
  name: string;
  suburb?: string;
}

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

export interface IStat {
  value: string;
  label: string;
}

export interface IAboutSection {
  eyebrow: string;
  heading: string;
  /** One paragraph per entry. */
  body: string[];
  stats: IStat[];
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
  city: string;
  country: string;
  planTitle: string;
  planBody: string;
  venues: IFestivalVenue[];
  comingSoonMonths: IComingSoonMonth[];
  hero: IHeroSection;
  about: IAboutSection;
  award: IAwardSection;
  cta: ICtaSection;
  /** Heading above the month-by-month schedule. */
  scheduleEyebrow: string;
  scheduleHeading: string;
  scheduleIntro: string;
}

const venueSchema = new Schema<IFestivalVenue>(
  {
    name: { type: String, required: true, trim: true, maxLength: 200 },
    suburb: { type: String, default: "", trim: true, maxLength: 200 },
  },
  { _id: true },
);

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

const statSchema = new Schema<IStat>(
  {
    value: { type: String, default: "", trim: true, maxLength: 40 },
    label: { type: String, default: "", trim: true, maxLength: 120 },
  },
  { _id: true },
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

const aboutSchema = new Schema<IAboutSection>(
  {
    eyebrow: { type: String, default: "The Festival", trim: true, maxLength: 200 },
    heading: { type: String, default: "A festival built around the films, not the fanfare", trim: true, maxLength: 300 },
    body: {
      type: [String],
      default: [
        "IFFA programmes two festivals every month — compact, themed weekends that put a handful of films in front of an audience properly, rather than burying them in a fortnight-long schedule nobody can follow.",
        "Every screening is curated. Every filmmaker is in the room. What began as a showcase for cinema from Oman, India, Malaysia and Spain now brings work from across the world to Melbourne's screens.",
      ],
    },
    stats: {
      type: [statSchema],
      default: () => [
        { value: "2", label: "Festivals every month" },
        { value: "20+", label: "Films screened a season" },
        { value: "5", label: "Venues across Melbourne" },
      ],
    },
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
    seriesLabel: { type: String, default: "Festival Series 2026", trim: true, maxLength: 200 },
    city: { type: String, default: "Melbourne", trim: true, maxLength: 120 },
    country: { type: String, default: "Australia", trim: true, maxLength: 120 },
    planTitle: { type: String, default: "Plan your festival nights", trim: true, maxLength: 200 },
    planBody: {
      type: String,
      default:
        "Booking opens closer to each festival weekend — until then, every screening time and venue below is confirmed programming.",
      trim: true,
      maxLength: 2000,
    },
    scheduleEyebrow: { type: String, default: "What's on", trim: true, maxLength: 200 },
    scheduleHeading: { type: String, default: "Upcoming festivals", trim: true, maxLength: 300 },
    scheduleIntro: {
      type: String,
      default:
        "Discover upcoming festivals and explore the films screening throughout each festival.",
      trim: true,
      maxLength: 1000,
    },
    venues: { type: [venueSchema], default: [] },
    comingSoonMonths: { type: [comingSoonMonthSchema], default: [] },
    hero: { type: heroSchema, default: () => ({}) },
    about: { type: aboutSchema, default: () => ({}) },
    award: { type: awardSchema, default: () => ({}) },
    cta: { type: ctaSectionSchema, default: () => ({}) },
  },
  { timestamps: true },
);

const FestivalSettings = model("FestivalSettings", festivalSettingsSchema);
export default FestivalSettings;
