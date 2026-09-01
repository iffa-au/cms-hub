"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/auth-context";
import { getData, updateData } from "@/lib/fetch-util";
import FestivalImageUpload, {
  uploadFestivalPageImage,
} from "@/components/festivals/festival-image-upload";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

/**
 * Everything on the public Festivals page that is not a festival: the hero, the
 * intro, the award spotlight, the schedule headings, the closing call to
 * action, the venue list, and the coming-soon months.
 *
 * Coming-soon months are edited here rather than derived, because they are an
 * editorial decision: the months holding published festivals are simply a fact,
 * but "October — coming soon" is someone choosing to promise it. Nothing about
 * an unannounced month's programme is stored, so nothing can leak through the
 * locked panel on the public page.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Cta = { label: string; href: string };
type Venue = { name: string; suburb: string };
type Stat = { value: string; label: string };
type ComingSoonMonth = { year: string; month: string; note: string };

/**
 * The settings document is a deep tree of optional fields, and this page reads
 * it defensively field by field rather than trusting a shape. `unknown` keeps
 * that honest: every read below goes through a narrowing helper.
 */
type Json = Record<string, unknown>;
type SettingsResponse = { success: boolean; message?: string; data: Json };

const obj = (value: unknown): Json =>
  value && typeof value === "object" ? (value as Json) : {};
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

const field =
  "w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground";
const labelClass = "mb-1 block text-xs text-muted-foreground";
const sectionClass = "mb-6 space-y-4 rounded-lg border border-border bg-card/60 p-6";
const headingClass =
  "text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground";

/** Paragraphs are edited as one textarea, split on blank lines. */
const toParagraphs = (text: string) =>
  text.split(/\n\s*\n/).map((line) => line.trim()).filter(Boolean);
const fromParagraphs = (list: unknown) =>
  Array.isArray(list) ? list.join("\n\n") : "";

/** Short lines are one per row. */
const toLines = (text: string) =>
  text.split("\n").map((line) => line.trim()).filter(Boolean);
const fromLines = (list: unknown) => (Array.isArray(list) ? list.join("\n") : "");

export default function FestivalSettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [seriesLabel, setSeriesLabel] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  const [heroEyebrow, setHeroEyebrow] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroImageKey, setHeroImageKey] = useState("");
  const [pendingHero, setPendingHero] = useState<File | null>(null);
  const [heroPrimary, setHeroPrimary] = useState<Cta>({ label: "", href: "" });
  const [heroSecondary, setHeroSecondary] = useState<Cta>({ label: "", href: "" });

  const [aboutEyebrow, setAboutEyebrow] = useState("");
  const [aboutHeading, setAboutHeading] = useState("");
  const [aboutBody, setAboutBody] = useState("");
  const [stats, setStats] = useState<Stat[]>([]);

  const [awardEyebrow, setAwardEyebrow] = useState("");
  const [awardHeading, setAwardHeading] = useState("");
  const [awardBody, setAwardBody] = useState("");
  const [awardImageUrl, setAwardImageUrl] = useState("");
  const [awardImageKey, setAwardImageKey] = useState("");
  const [pendingAward, setPendingAward] = useState<File | null>(null);
  const [awardPoints, setAwardPoints] = useState("");

  const [scheduleEyebrow, setScheduleEyebrow] = useState("");
  const [scheduleHeading, setScheduleHeading] = useState("");
  const [scheduleIntro, setScheduleIntro] = useState("");

  const [ctaEyebrow, setCtaEyebrow] = useState("");
  const [ctaHeading, setCtaHeading] = useState("");
  const [ctaBody, setCtaBody] = useState("");
  const [ctaPrimary, setCtaPrimary] = useState<Cta>({ label: "", href: "" });
  const [ctaSecondary, setCtaSecondary] = useState<Cta>({ label: "", href: "" });

  const [planTitle, setPlanTitle] = useState("");
  const [planBody, setPlanBody] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [comingSoon, setComingSoon] = useState<ComingSoonMonth[]>([]);

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getData<SettingsResponse>("/festivals/settings");
      const s = obj(res?.data);
      const cta = (raw: unknown): Cta => {
        const value = obj(raw);
        return { label: str(value.label), href: str(value.href) };
      };

      setSeriesLabel(str(s.seriesLabel));
      setCity(str(s.city));
      setCountry(str(s.country));

      setHeroEyebrow(str(obj(s.hero).eyebrow));
      setHeroTitle(str(obj(s.hero).title));
      setHeroSubtitle(str(obj(s.hero).subtitle));
      setHeroImageUrl(str(obj(s.hero).backgroundImageUrl));
      setHeroImageKey(str(obj(s.hero).backgroundImageKey));
      setHeroPrimary(cta(obj(s.hero).primaryCta));
      setHeroSecondary(cta(obj(s.hero).secondaryCta));

      setAboutEyebrow(str(obj(s.about).eyebrow));
      setAboutHeading(str(obj(s.about).heading));
      setAboutBody(fromParagraphs(obj(s.about).body));
      setStats(
        arr(obj(s.about).stats).map((raw) => {
          const stat = obj(raw);
          return { value: str(stat.value), label: str(stat.label) };
        }),
      );

      setAwardEyebrow(str(obj(s.award).eyebrow));
      setAwardHeading(str(obj(s.award).heading));
      setAwardBody(str(obj(s.award).body));
      setAwardImageUrl(str(obj(s.award).imageUrl));
      setAwardImageKey(str(obj(s.award).imageKey));
      setAwardPoints(fromLines(obj(s.award).points));

      setScheduleEyebrow(str(s.scheduleEyebrow));
      setScheduleHeading(str(s.scheduleHeading));
      setScheduleIntro(str(s.scheduleIntro));

      setCtaEyebrow(str(obj(s.cta).eyebrow));
      setCtaHeading(str(obj(s.cta).heading));
      setCtaBody(str(obj(s.cta).body));
      setCtaPrimary(cta(obj(s.cta).primaryCta));
      setCtaSecondary(cta(obj(s.cta).secondaryCta));

      setPlanTitle(str(s.planTitle));
      setPlanBody(str(s.planBody));
      setVenues(
        arr(s.venues).map((raw) => {
          const venue = obj(raw);
          return { name: str(venue.name), suburb: str(venue.suburb) };
        }),
      );
      setComingSoon(
        arr(s.comingSoonMonths).map((raw) => {
          const entry = obj(raw);
          return {
            year: entry.year ? String(entry.year) : "",
            month: entry.month ? String(entry.month) : "",
            note: str(entry.note),
          };
        }),
      );
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const badMonth = comingSoon.find(
      (entry) =>
        !Number.isInteger(Number(entry.year)) ||
        Number(entry.year) < 2000 ||
        !Number.isInteger(Number(entry.month)) ||
        Number(entry.month) < 1 ||
        Number(entry.month) > 12,
    );
    if (badMonth) {
      setError("Every coming-soon entry needs a valid year and month.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Images upload at save time, not on selection, so an abandoned edit
      // never leaves an orphan in the bucket. The backend deletes the previous
      // object once the new key lands.
      let nextHeroUrl = heroImageUrl;
      let nextHeroKey = heroImageKey;
      if (pendingHero) {
        const uploaded = await uploadFestivalPageImage(pendingHero, "festivals-hero");
        nextHeroUrl = uploaded.url;
        nextHeroKey = uploaded.key;
      }

      let nextAwardUrl = awardImageUrl;
      let nextAwardKey = awardImageKey;
      if (pendingAward) {
        const uploaded = await uploadFestivalPageImage(pendingAward, "iffa-award");
        nextAwardUrl = uploaded.url;
        nextAwardKey = uploaded.key;
      }

      await updateData("/festivals/settings", {
        seriesLabel: seriesLabel.trim(),
        city: city.trim(),
        country: country.trim(),
        scheduleEyebrow: scheduleEyebrow.trim(),
        scheduleHeading: scheduleHeading.trim(),
        scheduleIntro: scheduleIntro.trim(),
        planTitle: planTitle.trim(),
        planBody: planBody.trim(),
        hero: {
          eyebrow: heroEyebrow.trim(),
          title: heroTitle.trim(),
          subtitle: heroSubtitle.trim(),
          backgroundImageUrl: nextHeroUrl,
          backgroundImageKey: nextHeroKey,
          primaryCta: heroPrimary,
          secondaryCta: heroSecondary,
        },
        about: {
          eyebrow: aboutEyebrow.trim(),
          heading: aboutHeading.trim(),
          body: toParagraphs(aboutBody),
          stats: stats
            .map((stat) => ({ value: stat.value.trim(), label: stat.label.trim() }))
            .filter((stat) => stat.value || stat.label),
        },
        award: {
          eyebrow: awardEyebrow.trim(),
          heading: awardHeading.trim(),
          body: awardBody.trim(),
          imageUrl: nextAwardUrl,
          imageKey: nextAwardKey,
          points: toLines(awardPoints),
        },
        cta: {
          eyebrow: ctaEyebrow.trim(),
          heading: ctaHeading.trim(),
          body: ctaBody.trim(),
          primaryCta: ctaPrimary,
          secondaryCta: ctaSecondary,
        },
        venues: venues
          .map((venue) => ({ name: venue.name.trim(), suburb: venue.suburb.trim() }))
          .filter((venue) => venue.name),
        comingSoonMonths: comingSoon.map((entry) => ({
          year: Number(entry.year),
          month: Number(entry.month),
          note: entry.note.trim(),
        })),
      });

      setPendingHero(null);
      setPendingAward(null);
      setSuccess("Settings saved.");
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const CtaFields = ({
    legend,
    value,
    onChange,
  }: {
    legend: string;
    value: Cta;
    onChange: (next: Cta) => void;
  }) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className={labelClass}>{legend} — button text</label>
        <input
          className={field}
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="Leave empty to hide this button"
        />
      </div>
      <div>
        <label className={labelClass}>{legend} — link</label>
        <input
          className={field}
          value={value.href}
          onChange={(e) => onChange({ ...value, href: e.target.value })}
          placeholder="/submit-film or #schedule"
        />
      </div>
    </div>
  );

  if (!isAuthenticated) return null;
  if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") return null;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/festivals"
        className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={14} /> All festivals
      </Link>

      <h1 className="mb-2 font-serif text-3xl text-white md:text-4xl">Festivals Page</h1>
      <p className="mb-8 text-sm text-accent-foreground">
        Every section of the public Festivals page except the festivals themselves,
        which are managed separately.
      </p>

      {error && (
        <p className="mb-4 rounded border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm text-green-400">
          {success}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded bg-card/60" />
          <div className="h-32 animate-pulse rounded bg-card/60" />
        </div>
      ) : (
        <>
          <section className={sectionClass}>
            <h2 className={headingClass}>Hero — the full-screen opening</h2>
            <div>
              <label className={labelClass}>Eyebrow</label>
              <input className={field} value={heroEyebrow}
                onChange={(e) => setHeroEyebrow(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Headline</label>
              <textarea rows={2} className={field} value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Sub-line</label>
              <textarea rows={3} className={field} value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>
                Background image — landscape, at least 1920px wide
              </label>
              <FestivalImageUpload
                existingUrl={heroImageUrl}
                pendingFile={pendingHero}
                onSelect={setPendingHero}
                onClearExisting={() => { setHeroImageUrl(""); setHeroImageKey(""); }}
                label="Select hero background (PNG, WEBP or JPEG)"
              />
            </div>
            <CtaFields legend="Primary button" value={heroPrimary} onChange={setHeroPrimary} />
            <CtaFields legend="Secondary button" value={heroSecondary} onChange={setHeroSecondary} />
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>About the festival</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Eyebrow</label>
                <input className={field} value={aboutEyebrow}
                  onChange={(e) => setAboutEyebrow(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Heading</label>
                <input className={field} value={aboutHeading}
                  onChange={(e) => setAboutHeading(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>
                Body — leave a blank line between paragraphs
              </label>
              <textarea rows={7} className={field} value={aboutBody}
                onChange={(e) => setAboutBody(e.target.value)} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className={labelClass}>Stats ({stats.length})</label>
                <button type="button"
                  onClick={() => setStats((list) => [...list, { value: "", label: "" }])}
                  className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-[10px] font-bold tracking-widest text-muted-foreground hover:border-primary hover:text-primary">
                  <Plus size={12} /> ADD
                </button>
              </div>
              <div className="space-y-2">
                {stats.map((stat, index) => (
                  <div key={index} className="flex gap-2">
                    <input className={`${field} max-w-[120px]`} value={stat.value} placeholder="20+"
                      onChange={(e) =>
                        setStats((l) => l.map((s, i) => (i === index ? { ...s, value: e.target.value } : s)))
                      } />
                    <input className={field} value={stat.label} placeholder="Films screened a season"
                      onChange={(e) =>
                        setStats((l) => l.map((s, i) => (i === index ? { ...s, label: e.target.value } : s)))
                      } />
                    <button type="button" onClick={() => setStats((l) => l.filter((_, i) => i !== index))}
                      className="shrink-0 p-2 text-muted-foreground hover:text-red-400" aria-label="Remove stat">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Award spotlight</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Eyebrow</label>
                <input className={field} value={awardEyebrow}
                  onChange={(e) => setAwardEyebrow(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Heading</label>
                <input className={field} value={awardHeading}
                  onChange={(e) => setAwardHeading(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Body</label>
              <textarea rows={4} className={field} value={awardBody}
                onChange={(e) => setAwardBody(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>
                Trophy image — portrait, transparent background
              </label>
              <FestivalImageUpload
                shape="portrait"
                existingUrl={awardImageUrl}
                pendingFile={pendingAward}
                onSelect={setPendingAward}
                onClearExisting={() => { setAwardImageUrl(""); setAwardImageKey(""); }}
                label="Select trophy image (PNG, WEBP or JPEG)"
              />
            </div>
            <div>
              <label className={labelClass}>Points — one per line</label>
              <textarea rows={4} className={field} value={awardPoints}
                onChange={(e) => setAwardPoints(e.target.value)} />
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Schedule heading</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Eyebrow</label>
                <input className={field} value={scheduleEyebrow}
                  onChange={(e) => setScheduleEyebrow(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Heading</label>
                <input className={field} value={scheduleHeading}
                  onChange={(e) => setScheduleHeading(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Intro line</label>
              <textarea rows={2} className={field} value={scheduleIntro}
                onChange={(e) => setScheduleIntro(e.target.value)} />
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Closing call to action</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Eyebrow</label>
                <input className={field} value={ctaEyebrow}
                  onChange={(e) => setCtaEyebrow(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Heading</label>
                <input className={field} value={ctaHeading}
                  onChange={(e) => setCtaHeading(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Body</label>
              <textarea rows={3} className={field} value={ctaBody}
                onChange={(e) => setCtaBody(e.target.value)} />
            </div>
            <CtaFields legend="Primary button" value={ctaPrimary} onChange={setCtaPrimary} />
            <CtaFields legend="Secondary button" value={ctaSecondary} onChange={setCtaSecondary} />
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Venue band &amp; page details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className={labelClass}>Series label</label>
                <input className={field} value={seriesLabel}
                  onChange={(e) => setSeriesLabel(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input className={field} value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <input className={field} value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Band heading</label>
              <input className={field} value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Band body</label>
              <textarea rows={3} className={field} value={planBody}
                onChange={(e) => setPlanBody(e.target.value)} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className={labelClass}>Venues ({venues.length})</label>
                <button type="button"
                  onClick={() => setVenues((l) => [...l, { name: "", suburb: "" }])}
                  className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-[10px] font-bold tracking-widest text-muted-foreground hover:border-primary hover:text-primary">
                  <Plus size={12} /> ADD
                </button>
              </div>
              <div className="space-y-2">
                {venues.map((venue, index) => (
                  <div key={index} className="flex gap-2">
                    <input className={field} value={venue.name} placeholder="Main Theatre"
                      onChange={(e) =>
                        setVenues((l) => l.map((v, i) => (i === index ? { ...v, name: e.target.value } : v)))
                      } />
                    <input className={field} value={venue.suburb} placeholder="Melbourne CBD"
                      onChange={(e) =>
                        setVenues((l) => l.map((v, i) => (i === index ? { ...v, suburb: e.target.value } : v)))
                      } />
                    <button type="button" onClick={() => setVenues((l) => l.filter((_, i) => i !== index))}
                      className="shrink-0 p-2 text-muted-foreground hover:text-red-400" aria-label="Remove venue">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className={headingClass}>Coming soon ({comingSoon.length})</h2>
              <button type="button"
                onClick={() => setComingSoon((l) => [...l, { year: "", month: "", note: "" }])}
                className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs font-bold tracking-widest text-muted-foreground hover:border-primary hover:text-primary">
                <Plus size={14} /> ADD MONTH
              </button>
            </div>
            <p className="text-xs text-muted-foreground/70">
              Months shown as a locked “Coming Soon” panel after the published
              festivals. Nothing about their programme is stored.
            </p>
            {comingSoon.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">
                None — the page ends after the last published month.
              </p>
            ) : (
              <div className="space-y-3">
                {comingSoon.map((entry, index) => (
                  <div key={index} className="rounded border border-border p-3">
                    <div className="mb-2 flex gap-2">
                      <select className={field} value={entry.month}
                        onChange={(e) =>
                          setComingSoon((l) => l.map((m, i) => (i === index ? { ...m, month: e.target.value } : m)))
                        }>
                        <option value="">Month…</option>
                        {MONTHS.map((label, monthIndex) => (
                          <option key={label} value={monthIndex + 1}>{label}</option>
                        ))}
                      </select>
                      <input className={field} inputMode="numeric" placeholder="Year" value={entry.year}
                        onChange={(e) =>
                          setComingSoon((l) => l.map((m, i) => (i === index ? { ...m, year: e.target.value } : m)))
                        } />
                      <button type="button"
                        onClick={() => setComingSoon((l) => l.filter((_, i) => i !== index))}
                        className="shrink-0 p-2 text-muted-foreground hover:text-red-400" aria-label="Remove month">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <textarea rows={2} className={field} value={entry.note}
                      placeholder="More festivals and screening schedules will be announced soon."
                      onChange={(e) =>
                        setComingSoon((l) => l.map((m, i) => (i === index ? { ...m, note: e.target.value } : m)))
                      } />
                  </div>
                ))}
              </div>
            )}
          </section>

          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="rounded bg-foreground px-6 py-2.5 text-xs font-bold tracking-widest text-background transition-opacity hover:opacity-90 disabled:opacity-50">
            {saving ? "SAVING..." : "SAVE SETTINGS"}
          </button>
        </>
      )}
    </main>
  );
}
