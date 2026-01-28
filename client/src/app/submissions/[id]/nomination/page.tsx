'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { deleteData, getData, postData, updateData } from '@/lib/fetch-util';

const INPUT =
  'w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2';
const LABEL = 'text-accent-foreground text-xs font-bold uppercase tracking-widest';

type SubmissionDetail = { _id: string; title: string };
type AwardCategory = { _id: string; name: string };
type CrewMember = { _id: string; name: string };
type Nomination = {
  _id: string;
  submissionId: string;
  awardCategoryId: string;
  year: number;
  isWinner: boolean;
  crewMemberId?: string | null;
  awardCategoryName?: string | null;
  crewMemberName?: string | null;
};

export default function SubmissionNominationPage() {
  const { id } = useParams<{ id: string }>();
  const submissionId = id;

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [categories, setCategories] = useState<AwardCategory[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [items, setItems] = useState<Nomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [catId, setCatId] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [crewMemberId, setCrewMemberId] = useState<string>(''); // empty => whole production
  const [isWinner, setIsWinner] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit form state
  const [editing, setEditing] = useState<Nomination | null>(null);
  const [eCatId, setECatId] = useState<string>('');
  const [eYear, setEYear] = useState<string>('');
  const [eCrewMemberId, setECrewMemberId] = useState<string>('');
  const [eIsWinner, setEIsWinner] = useState<boolean>(false);
  const [eSaving, setESaving] = useState(false);
  const [eError, setEError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sub, cats, noms] = await Promise.all([
        getData<{ success: boolean; data: SubmissionDetail }>(`/submissions/${submissionId}`),
        getData<{ success: boolean; data: AwardCategory[] }>(`/award-categories`),
        getData<{ success: boolean; data: Nomination[] }>(`/nominations?submissionId=${submissionId}`),
      ]);
      if (sub?.data) setSubmission(sub.data);
      setCategories(cats?.data ?? []);
      setItems(noms?.data ?? []);

      // Load crew assigned to this submission: get assignments then filter members
      const assignments = await getData<{ success: boolean; data: { crewMemberId: string }[] }>(
        `/crew-assignments?submissionId=${submissionId}&limit=200`
      );
      const memberIds = new Set((assignments?.data ?? []).map((a) => a.crewMemberId));
      const allMembers = await getData<{ success: boolean; data: CrewMember[] }>(`/crew-members`);
      const filtered = (allMembers?.data ?? []).filter((m) => memberIds.has(m._id));
      setCrew(filtered);
    } catch (e: any) {
      setError(e?.message || 'Failed to load nominations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (submissionId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const onCreate = async () => {
    if (!catId || !year) {
      setFormError('Award category and year are required');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await postData('/nominations', {
        submissionId,
        awardCategoryId: catId,
        year: Number(year),
        isWinner,
        crewMemberId: crewMemberId || null,
      });
      // reset
      setCatId('');
      setYear('');
      setCrewMemberId('');
      setIsWinner(false);
      await load();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Failed to create nomination');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (nomId: string) => {
    try {
      await deleteData(`/nominations/${nomId}`);
      await load();
    } catch {
      /* ignore */
    }
  };

  const startEdit = (n: Nomination) => {
    setEditing(n);
    setECatId(n.awardCategoryId);
    setEYear(String(n.year));
    setECrewMemberId(n.crewMemberId || '');
    setEIsWinner(!!n.isWinner);
    setEError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEError(null);
  };

  const onUpdate = async () => {
    if (!editing) return;
    if (!eCatId || !eYear) {
      setEError('Award category and year are required');
      return;
    }
    setEError(null);
    setESaving(true);
    try {
      await updateData(`/nominations/${editing._id}`, {
        awardCategoryId: eCatId,
        year: Number(eYear),
        isWinner: eIsWinner,
        crewMemberId: eCrewMemberId || null,
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      setEError(e?.response?.data?.message || 'Failed to update nomination');
    } finally {
      setESaving(false);
    }
  };

  return (
    <main className='flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full'>
      <div className='flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4'>
        <div>
          <h1 className='font-serif text-3xl md:text-4xl text-white mb-2'>Award Nominations</h1>
          <p className='text-accent-foreground text-sm'>
            Tracking nominations for {submission ? `"${submission.title}"` : '…'}
          </p>
        </div>
      </div>

      {/* Submission history */}
      <section className='rounded border border-border bg-surface-dark mb-8'>
        <div className='px-6 py-4 border-b border-border'>
          <h3 className='text-white text-sm font-bold tracking-widest uppercase font-serif'>
            Submission History
          </h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-separate border-spacing-y-2'>
            <thead>
              <tr className='text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold'>
                <th className='px-4 py-3'>Award Edition (Year)</th>
                <th className='px-4 py-3'>Award Category</th>
                <th className='px-4 py-3'>Crew Member</th>
                <th className='px-4 py-3'>Status</th>
                <th className='px-4 py-3 text-right'>Actions</th>
              </tr>
            </thead>
            <tbody className='text-sm'>
              {loading ? (
                <tr className='bg-card/60'>
                  <td className='px-4 py-6' colSpan={5}>
                    <div className='animate-pulse h-4 w-1/3 bg-border rounded mb-3' />
                    <div className='animate-pulse h-3 w-2/3 bg-border rounded' />
                  </td>
                </tr>
              ) : error ? (
                <tr className='bg-card/60'>
                  <td className='px-4 py-6' colSpan={5}>
                    <span className='text-red-400 text-sm'>{error}</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr className='bg-card/60'>
                  <td className='px-4 py-6' colSpan={5}>
                    <span className='text-muted-foreground text-sm'>No nominations yet.</span>
                  </td>
                </tr>
              ) : (
                items.map((n) => (
                  <tr key={n._id} className='bg-card/60'>
                    <td className='px-4 py-6'>{n.year}</td>
                    <td className='px-4 py-6'>{n.awardCategoryName || '—'}</td>
                    <td className='px-4 py-6'>{n.crewMemberName || 'Whole Production'}</td>
                    <td className='px-4 py-6'>{n.isWinner ? 'Winner' : '—'}</td>
                    <td className='px-4 py-6 text-right'>
                      <div className='flex items-center justify-end space-x-3'>
                        <button
                          onClick={() => startEdit(n)}
                          className='text-primary hover:text-foreground transition-colors text-[10px] font-bold tracking-widest'
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => void onDelete(n._id)}
                          className='text-red-500 hover:text-red-400 transition-colors text-[10px] font-bold tracking-widest'
                        >
                          DELETE
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create new nomination */}
      <section className='rounded border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50'>
        <div className='px-6 py-4 border-b border-border'>
          <h3 className='text-white text-sm font-bold tracking-widest uppercase font-serif'>
            Create a new Nomination
          </h3>
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
            <label className={LABEL}>Crew Member</label>
            <select
              className={INPUT}
              value={crewMemberId}
              onChange={(e) => setCrewMemberId(e.target.value)}
            >
              <option value=''>Whole Production</option>
              {crew.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className='flex items-center gap-3'>
            <span className='text-accent-foreground text-xs font-bold uppercase tracking-widest'>
              Winner
            </span>
            <button
              type='button'
              role='switch'
              aria-checked={isWinner}
              onClick={() => setIsWinner((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isWinner ? 'bg-primary' : 'bg-[#2a2a2a]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  isWinner ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
            <span className='text-accent-foreground text-xs font-bold uppercase tracking-widest'>
              {isWinner ? 'Winner' : 'Not Winner'}
            </span>
          </div>
          {formError ? <p className='text-red-500 text-sm'>{formError}</p> : null}
          <div className='md:col-span-2 flex justify-end'>
            <button
              onClick={() => void onCreate()}
              disabled={saving}
              className='bg-primary hover:opacity-90 text-black px-6 py-2.5 rounded font-bold text-xs tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed'
            >
              {saving ? 'Saving...' : 'Save Nomination'}
            </button>
          </div>
        </div>
      </section>

      {/* Edit section */}
      {editing ? (
        <section className='mt-8 rounded border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50'>
          <div className='px-6 py-4 border-b border-border'>
            <h3 className='text-white text-sm font-bold tracking-widest uppercase font-serif'>
              Edit Nomination
            </h3>
          </div>
          <div className='p-6 grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <label className={LABEL}>Award Category</label>
              <select className={INPUT} value={eCatId} onChange={(e) => setECatId(e.target.value)}>
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
                inputMode='numeric'
                value={eYear}
                onChange={(e) => setEYear(e.target.value)}
              />
            </div>
            <div className='md:col-span-2'>
              <label className={LABEL}>Crew Member</label>
              <select
                className={INPUT}
                value={eCrewMemberId}
                onChange={(e) => setECrewMemberId(e.target.value)}
              >
                <option value=''>Whole Production</option>
                {crew.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className='flex items-center gap-3'>
              <span className='text-accent-foreground text-xs font-bold uppercase tracking-widest'>
                Winner
              </span>
              <button
                type='button'
                role='switch'
                aria-checked={eIsWinner}
                onClick={() => setEIsWinner((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  eIsWinner ? 'bg-primary' : 'bg-[#2a2a2a]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    eIsWinner ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className='text-accent-foreground text-xs font-bold uppercase tracking-widest'>
                {eIsWinner ? 'Winner' : 'Not Winner'}
              </span>
            </div>
            {eError ? <p className='text-red-500 text-sm'>{eError}</p> : null}
            <div className='md:col-span-2 flex justify-end gap-3'>
              <button
                onClick={cancelEdit}
                className='px-6 py-2.5 rounded bg-[#222] text-white hover:bg-[#333] border border-border font-bold uppercase tracking-widest text-xs'
              >
                Cancel
              </button>
              <button
                onClick={() => void onUpdate()}
                disabled={eSaving}
                className='bg-primary hover:opacity-90 text-black px-6 py-2.5 rounded font-bold text-xs tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed'
              >
                {eSaving ? 'Updating...' : 'Update Nomination'}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

