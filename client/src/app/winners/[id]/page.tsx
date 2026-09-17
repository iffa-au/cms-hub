'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getData, updateData } from '@/lib/fetch-util';
import { useAuth } from '@/providers/auth-context';
import { toast } from 'sonner';

const INPUT =
  'w-full bg-background border border-border rounded px-4 py-3 text-white placeholder:text-[var(--placeholder)] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2';
const LABEL = 'block text-xs font-medium text-label';

type Nomination = {
  _id: string;
  submissionId: string;
  awardCategoryId: string;
  year: number;
  isWinner: boolean;
  crewMemberId?: string | null;
};
type AwardCategory = { _id: string; name: string };
type CrewMember = { _id: string; name: string };
type Overview = {
  _id: string;
  title: string;
  synopsis?: string | null;
  potraitImageUrl?: string | null;
  status?: string | null;
  createdAt?: string | null;
  contentType?: { _id: string; name: string } | null;
};
type HistoryRow = {
  _id: string;
  year: number;
  isWinner: boolean;
  awardCategoryName?: string | null;
  crewMemberName?: string | null;
};

export default function WinnerDetailPage() {
  const { id } = useParams<{ id: string }>(); // nomination id
  const router = useRouter();
  const { user } = useAuth();

  const [nomination, setNomination] = useState<Nomination | null>(null);
  const [film, setFilm] = useState<Overview | null>(null);
  const [categories, setCategories] = useState<AwardCategory[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [catId, setCatId] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [crewMemberId, setCrewMemberId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Undo confirmation
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);

  // Restrict to admin/staff
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'staff') {
      router.replace('/dashboard');
    }
  }, [router, user]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const nomRes = await getData<{ success: boolean; data: Nomination }>(`/nominations/${id}`);
      const nom = nomRes?.data;
      if (!nom) {
        setError('Winner not found.');
        return;
      }
      setNomination(nom);
      setCatId(nom.awardCategoryId);
      setYear(String(nom.year));
      setCrewMemberId(nom.crewMemberId || '');

      const [overviewRes, catsRes, historyRes] = await Promise.all([
        getData<{ success: boolean; data: Overview }>(`/submissions/${nom.submissionId}/overview`),
        getData<{ success: boolean; data: AwardCategory[] }>(`/award-categories`),
        getData<{ success: boolean; data: HistoryRow[] }>(`/nominations?submissionId=${nom.submissionId}`),
      ]);
      setFilm(overviewRes?.data ?? null);
      setCategories(catsRes?.data ?? []);
      setHistory(historyRes?.data ?? []);

      // Crew assigned to this submission (for the crew-member dropdown)
      const assignments = await getData<{ success: boolean; data: { crewMemberId: string }[] }>(
        `/crew-assignments?submissionId=${nom.submissionId}&limit=200`
      );
      const memberIds = new Set((assignments?.data ?? []).map((a) => a.crewMemberId));
      const allMembers = await getData<{ success: boolean; data: CrewMember[] }>(`/crew-members`);
      setCrew((allMembers?.data ?? []).filter((m) => memberIds.has(m._id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load winner');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const categoryName = useMemo(
    () => categories.find((c) => c._id === catId)?.name ?? '—',
    [categories, catId]
  );

  const onSave = async () => {
    if (!nomination) return;
    if (!catId || !year.trim()) {
      toast.error('Award category and edition year are required');
      return;
    }
    setSaving(true);
    try {
      await updateData(`/nominations/${nomination._id}`, {
        awardCategoryId: catId,
        year: Number(year),
        crewMemberId: crewMemberId || null,
      });
      toast.success('Winner updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update winner');
    } finally {
      setSaving(false);
    }
  };

  const onUndo = async () => {
    if (!nomination) return;
    setUndoing(true);
    try {
      // Demote: drop the winner flag. The nomination stays, so the film
      // returns to the Nominations section instead of being deleted.
      await updateData(`/nominations/${nomination._id}`, { isWinner: false });
      toast.success(`"${film?.title ?? 'Film'}" moved back to Nominations`);
      router.push('/winners');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to undo winner');
      setUndoing(false);
      setConfirmingUndo(false);
    }
  };

  return (
    <main className='mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 max-w-7xl'>
      <div className='mb-6'>
        <button
          onClick={() => router.push('/winners')}
          className='text-sm text-muted-foreground transition-colors hover:text-foreground'
        >
          ← Back to Winners
        </button>
      </div>

      {loading ? (
        <div className='rounded border border-border bg-surface-dark p-8'>
          <div className='animate-pulse h-6 w-1/3 bg-border rounded mb-4' />
          <div className='animate-pulse h-4 w-2/3 bg-border rounded' />
        </div>
      ) : error ? (
        <div className='rounded border border-border bg-surface-dark p-8'>
          <span className='text-red-400 text-sm'>{error}</span>
        </div>
      ) : (
        <>
          {/* Header: film + the win */}
          <div className='flex flex-col md:flex-row gap-6 mb-8'>
            {film?.potraitImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={film.potraitImageUrl}
                alt={film?.title ?? 'Poster'}
                className='w-32 h-48 object-cover rounded border border-border shrink-0'
              />
            ) : null}
            <div className='flex-1'>
              <div className='flex items-center gap-3 mb-2'>
                <span className='inline-block rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground'>
                  Winner
                </span>
                <span className='block text-xs font-medium text-label'>
                  {film?.contentType?.name ?? '—'}
                </span>
              </div>
              <h1 className='font-serif text-3xl md:text-4xl text-white mb-2'>{film?.title ?? '—'}</h1>
              <p className='text-accent-foreground text-sm mb-4 max-w-3xl'>{film?.synopsis || '—'}</p>
              <div className='flex flex-wrap gap-x-8 gap-y-2 text-sm'>
                <div>
                  <span className={LABEL}>Award Category</span>
                  <div className='text-white mt-1'>{categoryName}</div>
                </div>
                <div>
                  <span className={LABEL}>Edition Year</span>
                  <div className='text-white mt-1'>{nomination?.year}</div>
                </div>
                <div>
                  <span className={LABEL}>Awarded To</span>
                  <div className='text-white mt-1'>
                    {crew.find((m) => m._id === crewMemberId)?.name || 'Whole Production'}
                  </div>
                </div>
                <div>
                  <span className={LABEL}>Submission Status</span>
                  <div className='text-white mt-1 capitalize'>{film?.status?.toLowerCase() ?? '—'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Edit the win */}
          <section className='rounded border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50 mb-8'>
            <div className='px-6 py-4 border-b border-border'>
              <h3 className='text-sm font-semibold'>Edit Win Details</h3>
            </div>
            <div className='p-6 grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <label className={LABEL}>Award Category</label>
                <select className={INPUT} value={catId} onChange={(e) => setCatId(e.target.value)}>
                  <option value='' disabled>
                    Select category
                  </option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Award Edition (Year)</label>
                <input
                  className={INPUT}
                  placeholder='e.g. 2026'
                  inputMode='numeric'
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
              <div className='md:col-span-2'>
                <label className={LABEL}>Awarded To</label>
                <select className={INPUT} value={crewMemberId} onChange={(e) => setCrewMemberId(e.target.value)}>
                  <option value=''>Whole Production</option>
                  {crew.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className='md:col-span-2 flex justify-end'>
                <button
                  onClick={() => void onSave()}
                  disabled={saving}
                  className='bg-primary hover:opacity-90 text-black px-6 py-2.5 rounded font-bold text-xs tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed'
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </section>

          {/* Nomination / win history for this film */}
          <section className='rounded border border-border bg-surface-dark mb-8'>
            <div className='px-6 py-4 border-b border-border'>
              <h3 className='text-sm font-semibold'>Submission History</h3>
              <p className='text-accent-foreground text-xs mt-1'>Every edition this film was nominated in, and what it won.</p>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full text-left border-separate border-spacing-y-2'>
                <thead>
                  <tr className='text-xs font-semibold text-muted-foreground'>
                    <th className='px-4 py-3'>Edition Year</th>
                    <th className='px-4 py-3'>Award Category</th>
                    <th className='px-4 py-3'>Awarded To</th>
                    <th className='px-4 py-3'>Result</th>
                  </tr>
                </thead>
                <tbody className='text-sm'>
                  {history.length === 0 ? (
                    <tr className='bg-card/60'>
                      <td className='px-4 py-6' colSpan={4}>
                        <span className='text-muted-foreground text-sm'>No nomination history.</span>
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h._id} className={`bg-card/60 ${h._id === nomination?._id ? 'border-l-2 border-primary' : ''}`}>
                        <td className='px-4 py-6'>{h.year}</td>
                        <td className='px-4 py-6'>{h.awardCategoryName || '—'}</td>
                        <td className='px-4 py-6'>{h.crewMemberName || 'Whole Production'}</td>
                        <td className='px-4 py-6'>
                          {h.isWinner ? (
                            <span className='text-primary font-bold'>Winner</span>
                          ) : (
                            <span className='text-muted-foreground'>Nominated</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Undo winner */}
          <section className='rounded border border-red-900/50 bg-surface-dark overflow-hidden'>
            <div className='px-6 py-4 border-b border-red-900/50'>
              <h3 className='text-sm font-semibold'>Undo Winner</h3>
            </div>
            <div className='p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
              <p className='text-accent-foreground text-sm max-w-2xl'>
                Move this film back to the Nominations section. Its nomination is kept — only the winner status is
                removed, and it will no longer appear on the public site as a winner.
              </p>
              <button
                onClick={() => setConfirmingUndo(true)}
                className='shrink-0 px-6 py-2.5 rounded border border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition-colors font-bold text-xs tracking-widest'
              >
                UNDO WINNER
              </button>
            </div>
          </section>

          {/* Undo confirmation modal */}
          {confirmingUndo ? (
            <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'>
              <div className='w-full max-w-md rounded border border-border bg-background p-6 shadow-2xl'>
                <h4 className='text-white font-serif text-lg mb-2'>Undo this winner?</h4>
                <p className='text-accent-foreground text-sm mb-6'>
                  {`"${film?.title ?? 'This film'}" will move back to Nominations for ${nomination?.year}. You can mark it a winner again later from the nomination page.`}
                </p>
                <div className='flex justify-end gap-3'>
                  <button
                    onClick={() => setConfirmingUndo(false)}
                    disabled={undoing}
                    className='inline-flex h-9 items-center justify-center rounded-md border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-60'
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void onUndo()}
                    disabled={undoing}
                    className='inline-flex h-9 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    {undoing ? 'Undoing...' : 'Yes, undo'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
