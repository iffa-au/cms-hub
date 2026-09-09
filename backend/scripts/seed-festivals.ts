/**
 * One-off import of the festivals that were hardcoded in the public site
 * (`iffa-2026/src/modules/festivals/data/festival-schedule.ts`) before the
 * Festivals page became CMS-driven.
 *
 *   npx tsx scripts/seed-festivals.ts            # dry run, writes nothing
 *   npx tsx scripts/seed-festivals.ts --confirm  # writes
 *
 * THIS WRITES TO THE PRODUCTION DATABASE. The backend's MONGO_URI points at
 * the live cluster from every environment, local included (see AGENTS.md), so
 * there is no "safe" place to try this out. Hence the explicit flag.
 *
 * Idempotent: a slug that already exists is skipped, never overwritten. Re-run
 * it after adding a festival here and only the new one lands.
 *
 * The payload is inlined rather than imported from the sibling repo — a seed
 * has to keep working after the file it came from is deleted.
 *
 * Hero and poster URLs point at CloudFront paths that already existed before
 * the festivals prefix did. Their `heroImageKey` / `posterKey` are therefore
 * left empty, which is what tells the cascade delete they are not ours to
 * remove — the same rule partner logos follow with `logoKey`.
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import mongoose from "mongoose";

import Festival, { type IScreening } from "../models/festival.model.js";
import FestivalSettings from "../models/festivalSettings.model.js";
import { buildFestivalAssetPrefix } from "../libs/s3.js";

const CF = "https://dhbdzeb2cbayq.cloudfront.net";

type SeedFestival = {
  slug: string;
  edition: string;
  name: string;
  tagline: string;
  description: string;
  heroImageUrl: string;
  startDate: string;
  endDate: string;
  screenings: IScreening[];
};

/** Fills the fields every screening shares, so the payload below stays readable. */
const screening = (
  partial: Partial<IScreening> & Pick<IScreening, "title" | "date">,
): IScreening => ({
  posterUrl: "",
  posterKey: "",
  country: "",
  year: 2026,
  genre: "",
  runtimeMinutes: 0,
  synopsis: "",
  trailerUrl: "",
  time: "",
  venue: "",
  seatStatus: "available",
  ...partial,
});

const FESTIVALS: SeedFestival[] = [
  {
    slug: "crossings",
    edition: "01",
    name: "Crossings",
    tagline: "Departures, returns, and the distance between",
    description:
      "The opening festival of the 2026 series gathers five films about leaving and arriving — a bachelor in Oran, an accountant keeping two sets of books, a forest four groups of people cannot agree on. Three nights across four countries.",
    heroImageUrl: `${CF}/iffa/images/Australia/great-ocean-road.webp`,
    startDate: "2026-08-07",
    endDate: "2026-08-09",
    screenings: [
      screening({
        title: "The Arab",
        posterUrl: `${CF}/iffa/images/THE-ARAB.jpg`,
        country: "Oman",
        genre: "Drama",
        runtimeMinutes: 106,
        synopsis:
          "Haroun is an old bachelor who has been living in Oran for several years, quietly navigating the tensions of identity, belonging, and the passage of time.",
        trailerUrl: "https://youtu.be/kk3jGmIcFi0",
        date: "2026-08-07",
        time: "7:30 PM",
        venue: "Main Theatre",
        seatStatus: "limited",
      }),
      screening({
        title: "Monsoon Ledger",
        country: "India",
        genre: "Drama",
        runtimeMinutes: 134,
        synopsis:
          "A small-town accountant keeps two sets of books: one for the mill that employs her village, and one for herself. The rains arrive early and both come due.",
        date: "2026-08-07",
        time: "8:00 PM",
        venue: "Cinema Two",
      }),
      screening({
        title: "Rainforest Hours",
        country: "Malaysia",
        year: 2025,
        genre: "Documentary",
        runtimeMinutes: 88,
        synopsis:
          "Shot across a single wet season, a portrait of the rangers, loggers and researchers who share one forest and agree on almost nothing.",
        date: "2026-08-08",
        time: "4:30 PM",
        venue: "Docklands Screen",
      }),
      screening({
        title: "Salt and Cinder",
        country: "Spain",
        genre: "Drama",
        runtimeMinutes: 110,
        synopsis:
          "Two sisters running a failing salt flat disagree about whether to sell. The summer, and the buyer, refuse to wait for them to decide.",
        date: "2026-08-08",
        time: "7:00 PM",
        venue: "Main Theatre",
        seatStatus: "sold-out",
      }),
      screening({
        title: "Sands of Qurayyat",
        country: "Oman",
        year: 2025,
        genre: "Drama",
        runtimeMinutes: 98,
        synopsis:
          "A retired fisherman returns to the village he left forty years ago and finds the coastline, and his family's memory of him, entirely rewritten.",
        date: "2026-08-09",
        time: "6:00 PM",
        venue: "Federation Hall",
      }),
    ],
  },
  {
    slug: "night-frequencies",
    edition: "02",
    name: "Night Frequencies",
    tagline: "Sound, signal and the small hours",
    description:
      "Late-programme cinema built around what people say when they think nobody is listening: a rooftop radio station, a heist that runs on nerve, and forty years of night-market tapes nobody thought to archive.",
    heroImageUrl: `${CF}/iffa/images/Australia/melbourne.webp`,
    startDate: "2026-08-21",
    endDate: "2026-08-23",
    screenings: [
      screening({
        title: "Tin Roof Radio",
        country: "India",
        genre: "Comedy / Drama",
        runtimeMinutes: 108,
        synopsis:
          "An unlicensed community radio station broadcast from a rooftop becomes the only place a neighbourhood will admit what it actually thinks.",
        date: "2026-08-21",
        time: "6:15 PM",
        venue: "Cinema Two",
      }),
      screening({
        title: "High Rollers",
        posterUrl: `${CF}/iffa/images/high-rollers.jpg`,
        country: "Oman",
        genre: "Action / Thriller",
        runtimeMinutes: 102,
        synopsis:
          "In a world where every gamble could be your last, master thief Mason must outwit merciless foes and the law to save the woman he loves. A high-stakes heist thriller that pits greed, loyalty, and courage against impossible odds.",
        trailerUrl: "https://www.youtube.com/watch?v=NhaXDfYundI",
        date: "2026-08-21",
        time: "8:00 PM",
        venue: "Main Theatre",
        seatStatus: "limited",
      }),
      screening({
        title: "The Night Market Tapes",
        country: "Malaysia",
        year: 2025,
        genre: "Music Documentary",
        runtimeMinutes: 79,
        synopsis:
          "A cassette seller's forty-year archive of night-market performances turns out to be the only surviving recording of an entire local music scene.",
        date: "2026-08-22",
        time: "7:00 PM",
        venue: "Riverside Pavilion",
      }),
      screening({
        title: "Chandni Crossing",
        country: "India",
        genre: "Thriller",
        runtimeMinutes: 119,
        synopsis:
          "A traffic constable at the city's busiest junction recognises the same car passing every night at 3am, and starts keeping a record nobody asked for.",
        date: "2026-08-22",
        time: "9:30 PM",
        venue: "Main Theatre",
        seatStatus: "limited",
      }),
      screening({
        title: "The Last Tram to Gracia",
        country: "Spain",
        year: 2025,
        genre: "Drama",
        runtimeMinutes: 97,
        synopsis:
          "On the final night of a decommissioned tram line, the driver takes a route that is no longer on any timetable.",
        date: "2026-08-23",
        time: "5:45 PM",
        venue: "Docklands Screen",
        seatStatus: "sold-out",
      }),
    ],
  },
  {
    slug: "inherited-ground",
    edition: "01",
    name: "Inherited Ground",
    tagline: "Land, family, and everything handed down",
    description:
      "Five films about what a family passes on whether or not anyone wants it — a workshop, a port, a half-finished summer. Screening across three nights in the Melbourne CBD and Southbank.",
    heroImageUrl: `${CF}/iffa/images/Australia/daintree-rainforest.webp`,
    startDate: "2026-09-04",
    endDate: "2026-09-06",
    screenings: [
      screening({
        title: "Kampung Static",
        country: "Malaysia",
        genre: "Drama",
        runtimeMinutes: 101,
        synopsis:
          "When the village finally gets reliable internet, a family that has spent a decade apart has to work out what they still have to say to each other.",
        date: "2026-09-04",
        time: "6:30 PM",
        venue: "Main Theatre",
      }),
      screening({
        title: "Harbour Lights",
        country: "Oman",
        genre: "Drama",
        runtimeMinutes: 112,
        synopsis:
          "A night-shift port controller starts logging the ships that never arrive, and slowly convinces an entire town that something is being hidden from them.",
        date: "2026-09-04",
        time: "9:00 PM",
        venue: "Cinema Two",
        seatStatus: "limited",
      }),
      screening({
        title: "The Kite Maker's Daughter",
        country: "India",
        year: 2025,
        genre: "Family Drama",
        runtimeMinutes: 96,
        synopsis:
          "The last kite maker on the street wants to close the workshop. His daughter has already entered it in a competition he does not know about.",
        date: "2026-09-05",
        time: "4:00 PM",
        venue: "Riverside Pavilion",
      }),
      screening({
        title: "Verano Interrumpido",
        country: "Spain",
        genre: "Drama",
        runtimeMinutes: 103,
        synopsis:
          "A family holiday is cut short by a phone call nobody will repeat out loud, and the drive home takes the rest of the film.",
        date: "2026-09-05",
        time: "7:30 PM",
        venue: "Main Theatre",
      }),
      screening({
        title: "Just One More",
        country: "Oman",
        year: 2025,
        genre: "Comedy",
        runtimeMinutes: 91,
        synopsis:
          "Two estranged brothers agree to one last late-night drive across the interior, and spend the entire journey failing to say the one thing that matters.",
        date: "2026-09-06",
        time: "6:00 PM",
        venue: "Federation Hall",
        seatStatus: "limited",
      }),
    ],
  },
  {
    slug: "the-long-way-home",
    edition: "02",
    name: "The Long Way Home",
    tagline: "Journeys that take longer than the road",
    description:
      "The September closing festival follows four journeys that refuse to end where they were meant to: a sleeper carriage past midnight, a frankincense route, a crossing, and a valley redrawn overnight.",
    heroImageUrl: `${CF}/iffa/images/Australia/gold-coast.webp`,
    startDate: "2026-09-18",
    endDate: "2026-09-20",
    screenings: [
      screening({
        title: "Nine Hours to Nagpur",
        country: "India",
        genre: "Road Drama",
        runtimeMinutes: 127,
        synopsis:
          "Four strangers share a long-distance sleeper carriage and discover, somewhere past midnight, that they are all travelling to the same funeral.",
        date: "2026-09-18",
        time: "7:30 PM",
        venue: "Main Theatre",
      }),
      screening({
        title: "The Frankincense Road",
        country: "Oman",
        year: 2025,
        genre: "Documentary",
        runtimeMinutes: 84,
        synopsis:
          "A documentary crew follows the last three families still harvesting frankincense by hand, and the buyers who have never once visited the trees.",
        date: "2026-09-19",
        time: "4:15 PM",
        venue: "Docklands Screen",
      }),
      screening({
        title: "Straits of Return",
        country: "Malaysia",
        genre: "Drama",
        runtimeMinutes: 116,
        synopsis:
          "A shipping clerk inherits a half-finished house on the other side of the water and a set of instructions she is not sure she wants to follow.",
        date: "2026-09-19",
        time: "6:45 PM",
        venue: "Cinema Two",
        seatStatus: "limited",
      }),
      screening({
        title: "Where the Wadi Turns",
        country: "Oman",
        genre: "Drama",
        runtimeMinutes: 105,
        synopsis:
          "After a flash flood redraws the valley, a schoolteacher must decide whether to rebuild in the same place or lead her students somewhere new.",
        date: "2026-09-20",
        time: "7:00 PM",
        venue: "Main Theatre",
        seatStatus: "sold-out",
      }),
    ],
  },
];

const SETTINGS = {
  seriesLabel: "Festival Series 2026",
  heroTitle: "Festivals",
  heroIntro:
    "Discover upcoming festivals and explore the films screening throughout each festival.",
  city: "Melbourne",
  country: "Australia",
  planTitle: "Plan your festival nights",
  planBody:
    "Booking opens closer to each festival weekend — until then, every screening time and venue below is confirmed programming.",
  venues: [
    { name: "Main Theatre", suburb: "Melbourne CBD" },
    { name: "Cinema Two", suburb: "Melbourne CBD" },
    { name: "Docklands Screen", suburb: "Docklands" },
    { name: "Federation Hall", suburb: "Southbank" },
    { name: "Riverside Pavilion", suburb: "South Wharf" },
  ],
  comingSoonMonths: [
    {
      year: 2026,
      month: 10,
      note: "More festivals and screening schedules will be announced soon. Programming is published roughly four weeks ahead of each festival weekend.",
    },
  ],
};

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("MONGO_URI is not set. Nothing to connect to.");
    process.exit(1);
  }

  // Enough of the host to recognise which cluster this is, without printing
  // credentials into a terminal or a CI log.
  const host = uri.replace(/^mongodb(\+srv)?:\/\/[^@]*@/, "").split("/")[0];

  console.log(`Target database host: ${host}`);
  console.log(
    `Payload: ${FESTIVALS.length} festivals, ` +
      `${FESTIVALS.reduce((total, f) => total + f.screenings.length, 0)} screenings, ` +
      `${SETTINGS.venues.length} venues, ${SETTINGS.comingSoonMonths.length} coming-soon month(s).\n`,
  );

  await mongoose.connect(uri);

  try {
    const existingSlugs = new Set(
      (await Festival.find({}, { slug: 1 }).lean()).map((f) => f.slug),
    );

    const toInsert = FESTIVALS.filter((f) => !existingSlugs.has(f.slug));
    const skipped = FESTIVALS.filter((f) => existingSlugs.has(f.slug));

    for (const festival of skipped) {
      console.log(`  skip   ${festival.slug} — already exists`);
    }
    for (const festival of toInsert) {
      console.log(`  insert ${festival.slug} (${festival.screenings.length} screenings)`);
    }

    const settingsExists = await FestivalSettings.exists({});
    console.log(
      settingsExists
        ? "  skip   settings — a settings document already exists"
        : "  insert settings",
    );

    if (!confirmed) {
      console.log(
        "\nDry run — nothing was written. Re-run with --confirm to apply to the " +
          "PRODUCTION database.",
      );
      return;
    }

    for (const festival of toInsert) {
      // Same shape a CMS-created festival gets, so seeded records are not a
      // special case anywhere downstream — uploads and cascade deletes both
      // resolve their folder from assetPrefix.
      const assetRef = randomUUID().replace(/-/g, "").slice(0, 8);

      await Festival.create({
        ...festival,
        assetRef,
        assetPrefix: buildFestivalAssetPrefix(assetRef, festival.name),
        heroImageKey: "",
        city: SETTINGS.city,
        isPublished: true,
      });
      console.log(`  created ${festival.slug}`);
    }

    if (!settingsExists) {
      await FestivalSettings.create(SETTINGS);
      console.log("  created settings");
    }

    console.log(
      `\nDone. ${toInsert.length} festival(s) created, ${skipped.length} skipped.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
