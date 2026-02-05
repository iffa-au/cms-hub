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
  productionHouse?: string;
  distributor?: string;
  crew?: {
    actors: Array<{ fullName: string; role: string; imageUrl?: string; instagramUrl?: string; biography?: string }>;
    directors: Array<{ fullName: string; role: string; imageUrl?: string; instagramUrl?: string; biography?: string }>;
    producers: Array<{ fullName: string; role: string; imageUrl?: string; instagramUrl?: string; biography?: string }>;
    other: Array<{ fullName: string; role: string; imageUrl?: string; instagramUrl?: string; biography?: string }>;
  };
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
  const [productionHouse, setProductionHouse] = useState<string>('');
  const [distributor, setDistributor] = useState<string>('');
  const [proposedCrew, setProposedCrew] = useState<NonNullable<SubmissionDetail['crew']>>({
    actors: [],
    directors: [],
    producers: [],
    other: [],
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        // submission overview with meta (single round-trip)
        try {
          const res = await getData<{ success: boolean; data: any }>(`/submissions/${id}/overview?expand=meta`);
          const d = res?.data;
          if (d && !cancelled) {
            // hydrate dropdown lists from meta if present
            if (d.meta) {
              setGenres(d.meta.genres || []);
              setCountries(d.meta.countries || []);
              setLanguages(d.meta.languages || []);
              setContentTypes(d.meta.contentTypes || []);
            }
            setTitle(d.title || '');
            setSynopsis(d.synopsis || '');
            setReleaseDate(d.releaseDate ? new Date(d.releaseDate).toISOString().slice(0, 10) : '');
            setPotraitImageUrl(d.potraitImageUrl || '');
            setLandscapeImageUrl(d.landscapeImageUrl || '');
            setImdbUrl(d.imdbUrl || '');
            setTrailerUrl(d.trailerUrl || '');
            setLanguageId(d.language?._id || d.languageId || '');
            setCountryId(d.country?._id || d.countryId || '');
            setContentTypeId(d.contentType?._id || d.contentTypeId || '');
            setProductionHouse(d.productionHouse || '');
            setDistributor(d.distributor || '');
            const genreIdList =
              Array.isArray(d.genres) && d.genres.length > 0
                ? d.genres.map((g: any) => g?._id).filter(Boolean)
                : Array.isArray(d.genreIds)
                  ? d.genreIds
                  : d.genreId
                    ? [d.genreId]
                    : [];
            setGenreIds(genreIdList);
            setProposedCrew({
              actors: Array.isArray(d.crew?.actors) ? d.crew.actors : [],
              directors: Array.isArray(d.crew?.directors) ? d.crew.directors : [],
              producers: Array.isArray(d.crew?.producers) ? d.crew.producers : [],
              other: Array.isArray(d.crew?.other) ? d.crew.other : [],
            });
          }
        } catch {
          // Fallback: fetch lists individually if meta not included/failed
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
          // Fallback to basic detail if overview not found
          const res2 = await getData<{ success: boolean; data: SubmissionDetail }>(`/submissions/${id}`);
          const d2 = res2?.data;
          if (d2 && !cancelled) {
            setTitle(d2.title || '');
            setSynopsis(d2.synopsis || '');
            setReleaseDate(d2.releaseDate ? new Date(d2.releaseDate).toISOString().slice(0, 10) : '');
            setPotraitImageUrl(d2.potraitImageUrl || '');
            setLandscapeImageUrl(d2.landscapeImageUrl || '');
            setImdbUrl(d2.imdbUrl || '');
            setTrailerUrl(d2.trailerUrl || '');
            setLanguageId(d2.languageId || '');
            setCountryId(d2.countryId || '');
            setContentTypeId(d2.contentTypeId || '');
            setProductionHouse(d2.productionHouse || '');
            setDistributor(d2.distributor || '');
            setGenreIds(d2.genreIds && d2.genreIds.length > 0 ? d2.genreIds : d2.genreId ? [d2.genreId] : []);
            setProposedCrew({
              actors: Array.isArray(d2.crew?.actors) ? d2.crew.actors : [],
              directors: Array.isArray(d2.crew?.directors) ? d2.crew.directors : [],
              producers: Array.isArray(d2.crew?.producers) ? d2.crew.producers : [],
              other: Array.isArray(d2.crew?.other) ? d2.crew.other : [],
            });
          }
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
        productionHouse: productionHouse.trim(),
        distributor: distributor.trim(),
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
              {/* primary language */}
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

              {/* production house */}
              <div className='space-y-2'>
                <label htmlFor='productionHouse' className={LABEL}>
                  Production House
                </label>
                <input
                  id='productionHouse'
                  className={INPUT}
                  type='text'
                  placeholder='e.g. Universal Pictures'
                  value={productionHouse}
                  onChange={(e) => setProductionHouse(e.target.value)}
                />
              </div>

              {/* distributor */}
              <div className='space-y-2'>
                <label htmlFor='distributor' className={LABEL}>
                  Distributor
                </label>
                <input
                  id='distributor'
                  className={INPUT}
                  type='text'
                  placeholder='e.g. Netflix'
                  value={distributor}
                  onChange={(e) => setDistributor(e.target.value)}
                />
              </div>

              {/* genres */}
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
            </div>
          </section>

          {(
            proposedCrew.actors.length ||
            proposedCrew.directors.length ||
            proposedCrew.producers.length ||
            proposedCrew.other.length
          ) ? (
            <section className='rounded-xl border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50'>
              <div className='px-8 py-6 border-b border-border flex justify-between items-center bg-surface-dark'>
                <div className='flex items-center gap-4'>
                  <h3 className='text-white text-lg font-bold tracking-widest uppercase font-serif'>
                    Proposed Crew (Public Submission)
                  </h3>
                </div>
                <div className='text-xs uppercase tracking-widest text-[#bab29c]'>Read-only</div>
              </div>
              <div className='p-8 space-y-10'>
                {([
                  ['Directors', proposedCrew.directors],
                  ['Producers', proposedCrew.producers],
                  ['Actors', proposedCrew.actors],
                  ['Other', proposedCrew.other],
                ] as const).map(([label, list]) =>
                  list.length ? (
                    <div key={label} className='space-y-4'>
                      <h4 className='text-white font-semibold tracking-widest uppercase text-sm'>{label}</h4>
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                        {list.map((p, idx) => (
                          <div
                            key={`${label}-${idx}-${p.fullName}-${p.role}`}
                            className='rounded border border-[#393528] p-4 bg-[#0b0b0b]'
                          >
                            <div className='flex flex-col gap-2'>
                              <div className='flex items-baseline justify-between'>
                                <div className='text-white font-medium'>{p.fullName || '—'}</div>
                                <div className='text-xs uppercase tracking-widest text-[#bab29c]'>{p.role || '—'}</div>
                              </div>
                              <div className='text-xs text-[#8a845f] break-all'>
                                Image URL:{' '}
                                {p.imageUrl ? (
                                  <a
                                    href={p.imageUrl}
                                    target='_blank'
                                    rel='noreferrer'
                                    className='text-primary underline break-all'
                                  >
                                    {p.imageUrl}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </div>
                              <div className='text-xs text-[#8a845f] break-all'>
                                Instagram:{' '}
                                {p.instagramUrl ? (
                                  <a
                                    href={p.instagramUrl}
                                    target='_blank'
                                    rel='noreferrer'
                                    className='text-primary underline break-all'
                                  >
                                    {p.instagramUrl}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </div>
                              <div className='text-sm text-[#d0c6a5] whitespace-pre-wrap'>
                                {p.biography || '—'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </section>
          ) : null}

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

