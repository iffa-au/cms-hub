"use client";

import { useEffect, useMemo, useState } from "react";
import { getData, updateData } from "@/lib/fetch-util";
import { useParams } from "next/navigation";
import { toast } from "sonner";

const INPUT =
  "w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2 disabled:opacity-70";
const LABEL =
  "text-accent-foreground text-xs font-bold uppercase tracking-widest";

type MetaItem = { _id: string; name: string; description?: string };

type Submission = {
  _id: string;
  title: string;
  synopsis: string;
  releaseDate: string;
  potraitImageUrl?: string;
  landscapeImageUrl?: string;
  languageId: string;
  countryId: string;
  contentTypeId: string;
  imdbUrl?: string;
  trailerUrl?: string;
  genreId: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
};

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Metadata
  const [genres, setGenres] = useState<MetaItem[]>([]);
  const [countries, setCountries] = useState<MetaItem[]>([]);
  const [languages, setLanguages] = useState<MetaItem[]>([]);
  const [contentTypes, setContentTypes] = useState<MetaItem[]>([]);

  // Fields
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [releaseDateStr, setReleaseDateStr] = useState("");
  const [potraitImageUrl, setPotraitImageUrl] = useState("");
  const [landscapeImageUrl, setLandscapeImageUrl] = useState("");
  const [imdbUrl, setImdbUrl] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [genreId, setGenreId] = useState<string>("");
  const [countryId, setCountryId] = useState<string>("");
  const [languageId, setLanguageId] = useState<string>("");
  const [contentTypeId, setContentTypeId] = useState<string>("");
  const [status, setStatus] = useState<Submission["status"]>("SUBMITTED");

  // Load metadata and submission
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const [g, c, l, ct] = await Promise.all([
          getData<{ success: boolean; data: MetaItem[] }>("/genres"),
          getData<{ success: boolean; data: MetaItem[] }>("/countries"),
          getData<{ success: boolean; data: MetaItem[] }>("/languages"),
          getData<{ success: boolean; data: MetaItem[] }>("/content-types"),
        ]);
        if (!isMounted) return;
        if (g?.success) setGenres(g.data || []);
        if (c?.success) setCountries(c.data || []);
        if (l?.success) setLanguages(l.data || []);
        if (ct?.success) setContentTypes(ct.data || []);
      } catch {
        // ignore; show page with empty selects
      }
      try {
        const res = await getData<{
          success: boolean;
          data: Submission;
          message?: string;
        }>(`/submissions/${id}`);
        if (!isMounted) return;
        if (res?.success && res.data) {
          const s = res.data;
          setTitle(s.title ?? "");
          setSynopsis(s.synopsis ?? "");
          // normalize date to yyyy-mm-dd
          const d = s.releaseDate ? new Date(s.releaseDate) : null;
          setReleaseDateStr(
            d && !Number.isNaN(d.getTime())
              ? d.toISOString().slice(0, 10)
              : ""
          );
          setPotraitImageUrl(s.potraitImageUrl ?? "");
          setLandscapeImageUrl(s.landscapeImageUrl ?? "");
          setImdbUrl(s.imdbUrl ?? "");
          setTrailerUrl(s.trailerUrl ?? "");
          setGenreId(s.genreId ?? "");
          setCountryId(s.countryId ?? "");
          setLanguageId(s.languageId ?? "");
          setContentTypeId(s.contentTypeId ?? "");
          setStatus(s.status ?? "SUBMITTED");
        } else {
          setError(res?.message || "Failed to load submission");
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load submission");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const heading = useMemo(
    () => (isEditing ? "Edit Submission" : "Submission Details"),
    [isEditing]
  );

  const onEditToggle = () => {
    setIsEditing((v) => !v);
    setError(null);
  };

  const onCancel = () => {
    // Reload submission to reset fields
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await getData<{ success: boolean; data: Submission }>(
          `/submissions/${id}`
        );
        if (res?.success && res.data) {
          const s = res.data;
          setTitle(s.title ?? "");
          setSynopsis(s.synopsis ?? "");
          const d = s.releaseDate ? new Date(s.releaseDate) : null;
          setReleaseDateStr(
            d && !Number.isNaN(d.getTime())
              ? d.toISOString().slice(0, 10)
              : ""
          );
          setPotraitImageUrl(s.potraitImageUrl ?? "");
          setLandscapeImageUrl(s.landscapeImageUrl ?? "");
          setImdbUrl(s.imdbUrl ?? "");
          setTrailerUrl(s.trailerUrl ?? "");
          setGenreId(s.genreId ?? "");
          setCountryId(s.countryId ?? "");
          setLanguageId(s.languageId ?? "");
          setContentTypeId(s.contentTypeId ?? "");
          setStatus(s.status ?? "SUBMITTED");
        }
      } finally {
        setIsLoading(false);
        setIsEditing(false);
      }
    })();
  };

  const onSave = async () => {
    if (isSaving) return;
    setError(null);
    setIsSaving(true);
    try {
      const payload = {
        title: title?.trim(),
        synopsis: synopsis?.trim(),
        releaseDate: releaseDateStr,
        potraitImageUrl,
        landscapeImageUrl,
        languageId,
        countryId,
        contentTypeId,
        genreId,
        imdbUrl,
        trailerUrl,
      };
      const res = await updateData<{
        success: boolean;
        data?: Submission;
        message?: string;
      }>(`/submissions/${id}`, payload);
      if (res && (res as any).success) {
        toast.success("Submission updated");
        setIsEditing(false);
      } else {
        setError((res as any)?.message || "Failed to update submission");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update submission");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex-1 w-full overflow-y-auto px-6 py-10 lg:px-10 scroll-smooth">
      <div className="max-w-6xl mx-auto pb-24">
        <h2 className="text-white text-3xl lg:text-4xl font-serif font-bold leading-tight tracking-wide mb-4">
          {heading}
        </h2>
        <p className="text-[#bab29c] text-lg font-light max-w-2xl mb-4">
          {isEditing
            ? "Update any details, then save your changes."
            : "View submission details. Click Edit to make changes."}
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <form
            className="flex flex-col gap-10"
            onSubmit={(e) => e.preventDefault()}
          >
            {/* Basic Information */}
            <section className="rounded-xl border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50">
              <div className="px-8 py-6 border-b border-border flex justify-between items-center bg-surface-dark">
                <div className="flex items-center gap-4">
                  <h3 className="text-white text-lg font-bold tracking-widest uppercase font-serif">
                    Basic Information
                  </h3>
                </div>
                <div className="text-xs uppercase tracking-widest text-[#bab29c]">
                  Status:{" "}
                  <span className="font-semibold text-white">{status}</span>
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
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!isEditing}
                  />
                </div>

                {/* synopsis */}
                <div className="md:col-span-2 space-y-2 relative">
                  <label htmlFor="synopsis" className={LABEL}>
                    Synopsis<span className="text-primary">*</span>
                  </label>
                  <textarea
                    className="w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none mt-2 disabled:opacity-70"
                    placeholder="Provide a brief synopsis of the film"
                    rows={4}
                    id="synopsis"
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    disabled={!isEditing}
                  ></textarea>
                </div>

                {/* release date */}
                <div className="space-y-2">
                  <label htmlFor="releaseDate" className={LABEL}>
                    Release Date<span className="text-primary">*</span>
                  </label>
                  <input
                    className={INPUT}
                    type="date"
                    id="releaseDate"
                    value={releaseDateStr}
                    onChange={(e) => setReleaseDateStr(e.target.value)}
                    disabled={!isEditing}
                  />
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
                    disabled={!isEditing}
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

                {/* genre */}
                <div className="space-y-2">
                  <label htmlFor="genre" className={LABEL}>
                    Genre<span className="text-primary">*</span>
                  </label>
                  <select
                    className={INPUT}
                    id="genre"
                    value={genreId ?? ""}
                    onChange={(e) => setGenreId(e.target.value)}
                    required
                    disabled={!isEditing}
                  >
                    <option value="" disabled>
                      Select genre
                    </option>
                    {genres.map((item) => (
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
                    disabled={!isEditing}
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
                    disabled={!isEditing}
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
                    value={potraitImageUrl}
                    onChange={(e) => setPotraitImageUrl(e.target.value)}
                    disabled={!isEditing}
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
                    value={landscapeImageUrl}
                    onChange={(e) => setLandscapeImageUrl(e.target.value)}
                    disabled={!isEditing}
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
                    value={imdbUrl}
                    onChange={(e) => setImdbUrl(e.target.value)}
                    disabled={!isEditing}
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
                    value={trailerUrl}
                    onChange={(e) => setTrailerUrl(e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </section>

            {/* Footer actions */}
            {error ? <p className="text-red-500 mt-2">{error}</p> : null}
            <div className="flex gap-4 w-full sm:w-auto justify-end mt-4">
              {!isEditing ? (
                <button
                  type="button"
                  className="flex-1 sm:flex-none px-8 py-3 rounded bg-primary text-black hover:bg-[#d9a50b] font-bold shadow-[0_0_20px_rgba(242,185,13,0.1)] hover:shadow-[0_0_30px_rgba(242,185,13,0.3)] transition-all duration-300 uppercase tracking-widest text-xs"
                  onClick={onEditToggle}
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex-1 sm:flex-none px-8 py-3 rounded bg-[#222] text-white hover:bg-[#333] border border-border font-bold transition-all duration-300 uppercase tracking-widest text-xs"
                    onClick={onCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={onSave}
                    className="flex-1 sm:flex-none px-8 py-3 rounded bg-primary text-black hover:bg-[#d9a50b] font-bold shadow-[0_0_20px_rgba(242,185,13,0.1)] hover:shadow-[0_0_30px_rgba(242,185,13,0.3)] transition-all duration-300 uppercase tracking-widest text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "Saving..." : "Save Edit"}
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

