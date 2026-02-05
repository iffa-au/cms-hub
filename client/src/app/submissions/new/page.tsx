"use client";

import { useEffect, useState } from "react";
import { getData, postData } from "@/lib/fetch-util";
import { useRouter } from "next/navigation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDownIcon } from "lucide-react";
import { Label } from "@radix-ui/react-dropdown-menu";

const INPUT =
  "w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2";

const LABEL =
  "text-accent-foreground text-xs font-bold uppercase tracking-widest";

type MetaItem = { _id: string; name: string; description?: string };

export default function NewSubmissionPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(undefined);
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [countryId, setCountryId] = useState<string | undefined>(undefined);
  const [languageId, setLanguageId] = useState<string | undefined>(undefined);
  const [contentTypeId, setContentTypeId] = useState<string | undefined>(
    undefined
  );
  const [genres, setGenres] = useState<MetaItem[]>([]);
  const [countries, setCountries] = useState<MetaItem[]>([]);
  const [languages, setLanguages] = useState<MetaItem[]>([]);
  const [contentTypes, setContentTypes] = useState<MetaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [potraitImageUrl, setPotraitImageUrl] = useState<string | undefined>(
    undefined
  );
  const [landscapeImageUrl, setLandscapeImageUrl] = useState<
    string | undefined
  >(undefined);
  const [imdbUrl, setImdbUrl] = useState<string | undefined>(undefined);
  const [trailerUrl, setTrailerUrl] = useState<string | undefined>(undefined);
  const [productionHouse, setProductionHouse] = useState<string>("");
  const [distributor, setDistributor] = useState<string>("");
  useEffect(() => {
    void (async () => {
      try {
        const [g, c, l, ct] = await Promise.all([
          getData<{ success: boolean; data: MetaItem[] }>("/genres"),
          getData<{ success: boolean; data: MetaItem[] }>("/countries"),
          getData<{ success: boolean; data: MetaItem[] }>("/languages"),
          getData<{ success: boolean; data: MetaItem[] }>("/content-types"),
        ]);
        if (g?.success) setGenres(g.data || []);
        if (c?.success) setCountries(c.data || []);
        if (l?.success) setLanguages(l.data || []);
        if (ct?.success) setContentTypes(ct.data || []);
      } catch {
        // noop: allow page to render without metadata
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {

    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const form = e.currentTarget;
      const titleEl = form.querySelector<HTMLInputElement>("#filmTitle");
      const synopsisEl = form.querySelector<HTMLTextAreaElement>("#synopsis");
      const dateEl = form.querySelector<HTMLInputElement>("#releaseDate");
      const payload = {
        title: titleEl?.value?.trim() || "",
        synopsis: synopsisEl?.value?.trim() || "",
        releaseDate: dateEl?.value || "",
        potraitImageUrl: potraitImageUrl ?? "",
        landscapeImageUrl: landscapeImageUrl ?? "",
        languageId,
        countryId,
        contentTypeId,
        // For backward compatibility, send both a primary genreId and the full list
        genreId: genreIds[0],
        genreIds,
        productionHouse: productionHouse.trim(),
        distributor: distributor.trim(),
      };
      if (
        !payload.title ||
        !payload.releaseDate ||
        !payload.languageId ||
        !payload.countryId ||
        !payload.contentTypeId ||
        !Array.isArray(payload.genreIds) ||
        payload.genreIds.length === 0
      ) {
        setError("Please fill all required fields.");
        setIsSubmitting(false);
        return;
      }
      const res = await postData<{
        success: boolean;
        data?: { _id: string };
        message?: string;
      }>("/submissions", payload);
      if (res && (res as any).success && (res as any).data?._id) {
        router.push("/dashboard");
      } else {
        setError((res as any)?.message || "Failed to create submission");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex-1 w-full overflow-y-auto px-6 py-10 lg:px-10 scroll-smooth">
      <div className="max-w-6xl mx-auto pb-24">
        <h2 className="text-white text-3xl lg:text-4xl font-serif font-bold leading-tight tracking-wide mb-4">
          Submit New Film Entry
        </h2>
        <p className="text-[#bab29c] text-lg font-light max-w-2xl mb-4">
          Enter details for the new film submission. Ensure all media links are
          high-resolution.
        </p>
        {/* Information Form */}
        <form className="flex flex-col gap-10" onSubmit={handleSubmit}>
          {/* Basic Information */}
          <section className="rounded-xl border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50">
            <div className="px-8 py-6 border-b border-border flex justify-between items-center bg-surface-dark">
              <div className="flex items-center gap-4">
                <h3 className="text-white text-lg font-bold tracking-widest uppercase font-serif">
                  Basic Information
                </h3>
              </div>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* film title */}
              <div className="md:col-span-2 space-y-2">
                <label htmlFor="filmTitle" className={LABEL}>
                  Film Title<span className="text-primary">*</span>
                </label>
                <input
                  className={INPUT}
                  placeholder="Enter full film title"
                  type="text"
                  id="filmTitle"
                />
              </div>

              {/* synopsis */}
              <div className="md:col-span-2 space-y-2 relative">
                <label htmlFor="synopsis" className={LABEL}>
                  Synopsis<span className="text-primary">*</span>
                </label>
                <textarea
                  className="w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none mt-2"
                  placeholder="Provide a brief synopsis of the film"
                  rows={4}
                  id="synopsis"
                ></textarea>
              </div>

              {/* release date */}
              <div className="space-y-2">
                <label htmlFor="releaseDate" className={LABEL}>
                  Release Date<span className="text-primary">*</span>
                </label>
                {/* Hidden input to participate in native form submit */}
                <input
                  id="releaseDate"
                  type="hidden"
                  value={releaseDate ? format(releaseDate, "yyyy-MM-dd") : ""}
                />
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2",
                        !releaseDate && "text-muted-foreground"
                      )}
                      onClick={() => setOpen(true)}
                    >
                      <span>
                        {releaseDate ? format(releaseDate, "PPP") : "Pick a date"}
                      </span>
                      <CalendarIcon className="h-4 w-4 opacity-70" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={releaseDate}
                      onSelect={(d) => {
                        setReleaseDate(d);
                        setOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* content type */}
              <div className="space-y-2">
                <label htmlFor="contentType" className={LABEL}>
                  Content Type<span className="text-primary">*</span>
                </label>
                <select
                  className={INPUT}
                  id="contentType"
                  value={contentTypeId ?? ""}
                  onChange={(e) => setContentTypeId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select content type
                  </option>
                  {contentTypes.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>



              {/* country of origin */}
              <div className="space-y-2">
                <label htmlFor="country" className={LABEL}>
                  Country of Origin<span className="text-primary">*</span>
                </label>
                <select
                  className={INPUT}
                  id="country"
                  value={countryId ?? ""}
                  onChange={(e) => setCountryId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select country
                  </option>
                  {countries.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* primary language */}
              <div className="space-y-2">
                <label htmlFor="language" className={LABEL}>
                  Primary Language<span className="text-primary">*</span>
                </label>
                <select
                  className={INPUT}
                  id="language"
                  value={languageId ?? ""}
                  onChange={(e) => setLanguageId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select language
                  </option>
                  {languages.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* production house */}
              <div className="space-y-2">
                <label htmlFor="productionHouse" className={LABEL}>
                  Production House
                </label>
                <input
                  className={INPUT}
                  id="productionHouse"
                  type="text"
                  placeholder="e.g. Universal Pictures"
                  value={productionHouse}
                  onChange={(e) => setProductionHouse(e.target.value)}
                />
              </div>
              {/* distributor */}
              <div className="space-y-2">
                <label htmlFor="distributor" className={LABEL}>
                  Distributor
                </label>
                <input
                  className={INPUT}
                  id="distributor"
                  type="text"
                  placeholder="e.g. Netflix"
                  value={distributor}
                  onChange={(e) => setDistributor(e.target.value)}
                />
              </div>

              {/* genres */}
              <div className="space-y-2">
                <label htmlFor="genre" className={LABEL}>
                  Genres<span className="text-primary">*</span>
                </label>
                <select
                  multiple
                  className={INPUT}
                  id="genre"
                  value={genreIds}
                  onChange={(e) =>
                    setGenreIds(
                      Array.from(e.currentTarget.selectedOptions).map((o) => o.value)
                    )
                  }
                  required
                >
                  {genres.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#8a845f]">Hold Cmd/Ctrl to select multiple.</p>
              </div>
            </div>
          </section>

          {/* Media & Links */}
          <section className="rounded-xl border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50">
            <div className="px-8 py-6 border-b border-border flex justify-between items-center bg-surface-dark">
              <div className="flex items-center gap-4">
                <h3 className="text-white text-lg font-bold tracking-widest uppercase font-serif">
                  Media & Links
                </h3>
              </div>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Potrait Image URL*/}
              <div className="space-y-2">
                <label htmlFor="potraitImageUrl" className={LABEL}>
                  Potrait Image URL
                </label>
                <input
                  className={INPUT}
                  type="text"
                  id="potraitImageUrl"
                  placeholder="https://example.com/poster.jpg"
                  value={potraitImageUrl ?? ""}
                  onChange={(e) => setPotraitImageUrl(e.target.value)}
                />
              </div>

              {/* Landscape Image URL */}
              <div className="space-y-2">
                <label htmlFor="landscapeImageUrl" className={LABEL}>
                  Landscape Image URL
                </label>
                <input
                  className={INPUT}
                  type="text"
                  id="landscapeImageUrl"
                  placeholder="https://example.com/banner.jpg"
                  value={landscapeImageUrl ?? ""}
                  onChange={(e) => setLandscapeImageUrl(e.target.value)}
                />
              </div>

              {/* IMDb URL */}
              <div className="space-y-2">
                <label htmlFor="imdbUrl" className={LABEL}>
                  IMDb URL
                </label>

                <input
                  className={INPUT}
                  type="text"
                  id="imdbUrl"
                  placeholder="https://imdb.com/title/..."
                  value={imdbUrl ?? ""}
                  onChange={(e) => setImdbUrl(e.target.value)}
                />
              </div>

              {/* Trailer URL */}
              <div className="space-y-2">
                <label htmlFor="trailerUrl" className={LABEL}>
                  Trailer URL
                </label>
                <input
                  className={INPUT}
                  type="text"
                  id="trailerUrl"
                  placeholder="Enter your trailer URL"
                  value={trailerUrl ?? ""}
                  onChange={(e) => setTrailerUrl(e.target.value)}
                />
              </div>
            </div>
          </section>
          {/* Footer (inside the form so submit works) */}
          {error ? <p className="text-red-500 mt-4">{error}</p> : null}
          <div className="flex gap-4 w-full sm:w-auto justify-end mt-10">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-8 py-3 rounded bg-primary text-black hover:bg-[#d9a50b] font-bold shadow-[0_0_20px_rgba(242,185,13,0.1)] hover:shadow-[0_0_30px_rgba(242,185,13,0.3)] transition-all duration-300 uppercase tracking-widest text-xs flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Submit Film"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

// Options are fetched dynamically from the API; no static mocks.
