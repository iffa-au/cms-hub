'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getData, postData, updateData } from '@/lib/fetch-util';

const INPUT =
  'w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2';
const LABEL = 'text-accent-foreground text-xs font-bold uppercase tracking-widest';

type MetaItem = { _id: string; name: string; description?: string };
type SubmissionDetail = {
  _id: string;
  title: string;
  synopsis?: string;
  releaseDate: string;
  potraitImageUrl?: string;
  landscapeImageUrl?: string;
  languageId: string;
  countryId: string;
  contentTypeId: string;
  imdbUrl?: string;
  trailerUrl?: string;
  genreId?: string;
  genreIds?: string[];
};

export default function EditSubmissionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const searchParams = useSearchParams();
  const from = searchParams?.get('from');

  const [genres, setGenres] = useState<MetaItem[]>([]);
  const [countries, setCountries] = useState<MetaItem[]>([]);
  const [languages, setLanguages] = useState<MetaItem[]>([]);
  const [contentTypes, setContentTypes] = useState<MetaItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // edit state
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [releaseDate, setReleaseDate] = useState<string>('');
  const [potraitImageUrl, setPotraitImageUrl] = useState<string>('');
  const [landscapeImageUrl, setLandscapeImageUrl] = useState<string>('');
  const [imdbUrl, setImdbUrl] = useState<string>('');
  const [trailerUrl, setTrailerUrl] = useState<string>('');
  const [languageId, setLanguageId] = useState<string>('');
  const [countryId, setCountryId] = useState<string>('');
  const [contentTypeId, setContentTypeId] = useState<string>('');
  const [genreIds, setGenreIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        // metadata
        const [g, c, l, ct] = await Promise.all([
          getData<{ success: boolean; data: MetaItem[] }>('/genres'),
          getData<{ success: boolean; data: MetaItem[] }>('/countries'),
          getData<{ success: boolean; data: MetaItem[] }>('/languages'),
          getData<{ success: boolean; data: MetaItem[] }>('/content-types'),
        ]);
        if (!cancelled) {
          if (g?.success) setGenres(g.data || []);
          if (c?.success) setCountries(c.data || []);
          if (l?.success) setLanguages(l.data || []);
          if (ct?.success) setContentTypes(ct.data || []);
        }
        // submission detail
        const res = await getData<{ success: boolean; data: SubmissionDetail }>(`/submissions/${id}`);
        const d = res?.data;
        if (d && !cancelled) {
          setTitle(d.title || '');
          setSynopsis(d.synopsis || '');
          setReleaseDate(d.releaseDate ? new Date(d.releaseDate).toISOString().slice(0, 10) : '');
          setPotraitImageUrl(d.potraitImageUrl || '');
          setLandscapeImageUrl(d.landscapeImageUrl || '');
          setImdbUrl(d.imdbUrl || '');
          setTrailerUrl(d.trailerUrl || '');
          setLanguageId(d.languageId || '');
          setCountryId(d.countryId || '');
          setContentTypeId(d.contentTypeId || '');
          setGenreIds(d.genreIds && d.genreIds.length > 0 ? d.genreIds : d.genreId ? [d.genreId] : []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load submission');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        synopsis: synopsis.trim(),
        releaseDate,
        potraitImageUrl,
        landscapeImageUrl,
        languageId,
        countryId,
        contentTypeId,
        genreId: genreIds[0],
        genreIds,
        imdbUrl,
        trailerUrl,
      };
      const res = await updateData<{ success: boolean; data?: SubmissionDetail; message?: string }>(
        `/submissions/${id}`,
        payload
      );
      if ((res as any)?.success) {
        if (from === 'review-queue') {
          router.push('/review-queue');
        } else {
          router.push('/dashboard');
        }
      } else {
        setError((res as any)?.message || 'Failed to update submission');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update submission');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className='flex-1 w-full overflow-y-auto px-6 py-10 lg:px-10 scroll-smooth'>
      <div className='max-w-6xl mx-auto pb-24'>
        <h2 className='text-white text-3xl lg:text-4xl font-serif font-bold leading-tight tracking-wide mb-4'>
          Edit Film Entry
        </h2>
        <p className='text-[#bab29c] text-lg font-light max-w-2xl mb-4'>
          Update details for the film submission.
        </p>
        <form className='flex flex-col gap-10' onSubmit={handleSubmit}>
          <section className='rounded-xl border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50'>
            <div className='px-8 py-6 border-b border-border flex justify-between items-center bg-surface-dark'>
              <div className='flex items-center gap-4'>
                <h3 className='text-white text-lg font-bold tracking-widest uppercase font-serif'>Basic Information</h3>
              </div>
            </div>
            <div className='p-8 grid grid-cols-1 md:grid-cols-2 gap-8'>
              <div className='md:col-span-2 space-y-2'>
                <label htmlFor='filmTitle' className={LABEL}>
                  Film Title<span className='text-primary'>*</span>
                </label>
                <input
                  id='filmTitle'
                  className={INPUT}
                  placeholder='Enter full film title'
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className='md:col-span-2 space-y-2 relative'>
                <label htmlFor='synopsis' className={LABEL}>
                  Synopsis<span className='text-primary'>*</span>
                </label>
                <textarea
                  id='synopsis'
                  className='w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none mt-2'
                  placeholder='Provide a brief synopsis of the film'
                  rows={4}
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <label htmlFor='releaseDate' className={LABEL}>
                  Release Date<span className='text-primary'>*</span>
                </label>
                <input
                  id='releaseDate'
                  className={INPUT}
                  type='date'
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <label htmlFor='contentType' className={LABEL}>
                  Content Type<span className='text-primary'>*</span>
                </label>
                <select
                  id='contentType'
                  className={INPUT}
                  value={contentTypeId}
                  onChange={(e) => setContentTypeId(e.target.value)}
                  required
                >
                  <option value='' disabled>
                    Select content type
                  </option>
                  {contentTypes.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className='space-y-2'>
                <label htmlFor='genre' className={LABEL}>
                  Genres<span className='text-primary'>*</span>
                </label>
                <select
                  id='genre'
                  multiple
                  className={INPUT}
                  value={genreIds}
                  onChange={(e) =>
                    setGenreIds(Array.from(e.currentTarget.selectedOptions).map((o) => o.value))
                  }
                  required
                >
                  {genres.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <p className='text-xs text-[#8a845f]'>Hold Cmd/Ctrl to select multiple.</p>
              </div>

              <div className='space-y-2'>
                <label htmlFor='country' className={LABEL}>
                  Country of Origin<span className='text-primary'>*</span>
                </label>
                <select
                  id='country'
                  className={INPUT}
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  required
                >
                  <option value='' disabled>
                    Select country
                  </option>
                  {countries.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className='space-y-2'>
                <label htmlFor='language' className={LABEL}>
                  Primary Language<span className='text-primary'>*</span>
                </label>
                <select
                  id='language'
                  className={INPUT}
                  value={languageId}
                  onChange={(e) => setLanguageId(e.target.value)}
                  required
                >
                  <option value='' disabled>
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

          <section className='rounded-xl border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50'>
            <div className='px-8 py-6 border-b border-border flex justify-between items-center bg-surface-dark'>
              <div className='flex items-center gap-4'>
                <h3 className='text-white text-lg font-bold tracking-widest uppercase font-serif'>Media & Links</h3>
              </div>
            </div>
            <div className='p-8 grid grid-cols-1 md:grid-cols-2 gap-8'>
              <div className='space-y-2'>
                <label htmlFor='potraitImageUrl' className={LABEL}>
                  Potrait Image URL
                </label>
                <input
                  id='potraitImageUrl'
                  className={INPUT}
                  type='text'
                  placeholder='https://example.com/poster.jpg'
                  value={potraitImageUrl}
                  onChange={(e) => setPotraitImageUrl(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <label htmlFor='landscapeImageUrl' className={LABEL}>
                  Landscape Image URL
                </label>
                <input
                  id='landscapeImageUrl'
                  className={INPUT}
                  type='text'
                  placeholder='https://example.com/banner.jpg'
                  value={landscapeImageUrl}
                  onChange={(e) => setLandscapeImageUrl(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <label htmlFor='imdbUrl' className={LABEL}>
                  IMDb URL
                </label>
                <input
                  id='imdbUrl'
                  className={INPUT}
                  type='text'
                  placeholder='https://imdb.com/title/...'
                  value={imdbUrl}
                  onChange={(e) => setImdbUrl(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <label htmlFor='trailerUrl' className={LABEL}>
                  Trailer URL
                </label>
                <input
                  id='trailerUrl'
                  className={INPUT}
                  type='text'
                  placeholder='Enter your trailer URL'
                  value={trailerUrl}
                  onChange={(e) => setTrailerUrl(e.target.value)}
                />
              </div>
            </div>
          </section>

          {error ? <p className='text-red-500 mt-4'>{error}</p> : null}
          <div className='flex gap-4 w-full sm:w-auto justify-end mt-10'>
            <button
              type='submit'
              disabled={saving}
              className='flex-1 sm:flex-none px-8 py-3 rounded bg-primary text-black hover:bg-[#d9a50b] font-bold shadow-[0_0_20px_rgba(242,185,13,0.1)] hover:shadow-[0_0_30px_rgba(242,185,13,0.3)] transition-all duration-300 uppercase tracking-widest text-xs flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed'
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

