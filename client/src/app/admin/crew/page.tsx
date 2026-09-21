'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteData, getData, postData } from '@/lib/fetch-util';
import { Search, X } from 'lucide-react';
import { SkeletonRows } from '@/components/skeleton';
import ConfirmDialog from '@/components/confirm-dialog';

type CrewMember = {
  _id: string;
  name: string;
  biography?: string;
  description?: string;
  profilePicture?: string;
};

type CrewRole = {
  _id: string;
  name: string;
  description?: string;
};

export default function AdminCrewPage() {
  const router = useRouter();
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [roles, setRoles] = useState<CrewRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // search
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return members;
    return members.filter((m) => m.name.toLowerCase().includes(term));
  }, [members, q]);

  // role creation
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Deleting either kind can now be refused by the API rather than silently
  // orphaning its references: a role still used by crew assignments answers
  // 409, as does a person named on a nomination. Those messages carry the
  // count, so they have to reach the screen — this page used to discard every
  // delete error, which made a refusal look like a dead button.
  const [pendingDelete, setPendingDelete] = useState<
    { kind: 'member' | 'role'; id: string; name: string } | null
  >(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const messageFrom = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    (e as { message?: string })?.message ||
    fallback;

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const [m, r] = await Promise.all([
        getData<{ success: boolean; data: CrewMember[] }>('/crew-members'),
        getData<{ success: boolean; data: CrewRole[] }>('/crew-roles'),
      ]);
      setMembers(m?.data ?? []);
      setRoles(r?.data ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load crew directory');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const addRole = async () => {
    if (!roleName.trim()) {
      setRoleError('Role name is required');
      return;
    }
    setRoleError(null);
    setSavingRole(true);
    try {
      await postData('/crew-roles', { name: roleName.trim(), description: roleDesc.trim() });
      setRoleName('');
      setRoleDesc('');
      await loadAll();
    } catch (e: any) {
      setRoleError(e?.response?.data?.message || 'Failed to add role');
    } finally {
      setSavingRole(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { kind, id } = pendingDelete;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteData(kind === 'role' ? `/crew-roles/${id}` : `/crew-members/${id}`);
      setPendingDelete(null);
      await loadAll();
    } catch (e: unknown) {
      // Kept on screen after the dialog closes: a 409 explains how many
      // records are in the way, which is the whole point of the refusal.
      setDeleteError(messageFrom(e, `Failed to delete ${kind === 'role' ? 'role' : 'crew member'}`));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className='mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 max-w-7xl'>
      <div className='flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>Crew Directory</h1>
          <p className='text-accent-foreground text-sm'>Manage people and their default bios.</p>
        </div>
        <button
          onClick={() => router.push('/crew/create?next=/admin/crew')}
          className='bg-primary hover:opacity-90 text-black px-6 py-2.5 rounded font-bold text-sm tracking-widest transition-all transform hover:scale-105 shadow-lg shadow-primary/20 flex items-center gap-2'
        >
          ADD CREW MEMBER
        </button>
      </div>

      {/* Search bar */}
      <div className='bg-card p-2 rounded border border-border mb-8'>
        <div className='relative grow'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQ('');
            }}
            className='w-full bg-transparent border-none focus:ring-0 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/70 py-3'
            placeholder='Search crew by name'
            type='text'
            aria-label='Search crew by name'
          />
          {q ? (
            <button
              aria-label='Clear search'
              onClick={() => setQ('')}
              className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1 rounded'
            >
              <X className='h-4 w-4' />
            </button>
          ) : null}
        </div>
      </div>

      {deleteError ? (
        <div className='mb-6 flex items-start justify-between gap-4 rounded border border-status-rejected/40 bg-status-rejected/10 px-4 py-3'>
          <p className='text-sm text-status-rejected'>{deleteError}</p>
          <button
            onClick={() => setDeleteError(null)}
            aria-label='Dismiss'
            className='shrink-0 text-muted-foreground transition-colors hover:text-foreground'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
      ) : null}

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Left: Crew list */}
        <section className='lg:col-span-2 rounded border border-border bg-surface-dark h-[520px] flex flex-col overflow-hidden'>
          <div className='px-6 py-4 border-b border-border'>
            <h3 className='text-sm font-semibold'>All Crew Members</h3>
          </div>
          <div className='divide-y divide-border flex-1 overflow-y-auto min-h-0'>
            {loading ? (
              <SkeletonRows rows={4} className='p-6' label='Loading crew members' />
            ) : error ? (
              <div className='p-6 text-sm text-red-400'>{error}</div>
            ) : filtered.length === 0 ? (
              <div className='p-6 text-sm text-muted-foreground'>No crew found.</div>
            ) : (
              filtered.map((m) => (
                <div key={m._id} className='p-6 flex items-start justify-between gap-4 hover:bg-black/20'>
                  <div>
                    <div className='text-white font-medium'>{m.name}</div>
                    <div className='text-xs text-muted-foreground line-clamp-2 max-w-2xl'>
                      {m.biography || m.description || '—'}
                    </div>
                  </div>
                  <div className='flex items-center gap-2 shrink-0'>
                    <button
                      onClick={() => router.push(`/crew/create?id=${m._id}&next=/admin/crew`)}
                      className='text-xs font-semibold text-primary underline-offset-4 transition-colors hover:text-foreground hover:underline'
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => setPendingDelete({ kind: 'member', id: m._id, name: m.name })}
                      className='text-xs font-semibold text-status-rejected underline-offset-4 transition-colors hover:text-foreground hover:underline'
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right: Role management */}
        <section className='rounded border border-border bg-surface-dark h-[520px] flex flex-col overflow-hidden'>
          <div className='px-6 py-4 border-b border-border'>
            <h3 className='text-sm font-semibold'>Crew Roles</h3>
          </div>
          <div className='p-6 space-y-4 flex-1 flex flex-col min-h-0'>
            <div>
              <label className='block text-xs font-medium text-label'>Role Name</label>
              <input
                className='w-full bg-background border border-border rounded px-4 py-3 text-white placeholder:text-[var(--placeholder)] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2'
                placeholder='e.g. Director'
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-label'>Description</label>
              <textarea
                className='w-full bg-background border border-border rounded px-4 py-3 text-white placeholder:text-[var(--placeholder)] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2 resize-none'
                placeholder='Optional details'
                rows={3}
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
              />
            </div>
            {roleError ? <p className='text-red-500 text-sm'>{roleError}</p> : null}
            <div className='flex justify-end'>
              <button
                onClick={() => void addRole()}
                disabled={savingRole}
                className='bg-primary hover:opacity-90 text-black px-6 py-2.5 rounded font-bold text-xs tracking-widest transition-all'
              >
                {savingRole ? 'Adding…' : 'Add Role'}
              </button>
            </div>
            <div className='h-px w-full bg-border my-2' />
            <div className='space-y-2 flex-1 overflow-y-auto min-h-0'>
              {roles.length === 0 ? (
                <div className='text-sm text-muted-foreground'>No roles yet.</div>
              ) : (
                roles.map((r) => (
                  <div key={r._id} className='flex items-center justify-between gap-2 p-2 rounded hover:bg-black/20'>
                    <div>
                      <div className='text-white text-sm'>{r.name}</div>
                      {r.description ? (
                        <div className='text-xs text-muted-foreground'>{r.description}</div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => setPendingDelete({ kind: 'role', id: r._id, name: r.name })}
                      className='text-xs font-semibold text-status-rejected underline-offset-4 transition-colors hover:text-foreground hover:underline'
                    >
                      DELETE
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Every other destructive action in the CMS confirms first; this page
          was missed. It matters more here now that deleting a person also
          removes the crew assignments linking them to films. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        tone='danger'
        busy={deleting}
        title={
          pendingDelete?.kind === 'role' ? 'Delete this role?' : 'Delete this crew member?'
        }
        description={
          pendingDelete?.kind === 'role' ? (
            <>
              <span className='text-foreground'>{pendingDelete?.name}</span> will be removed
              from the role list. If any crew assignment still uses it, the delete will be
              refused rather than leaving those credits pointing at nothing.
            </>
          ) : (
            <>
              <span className='text-foreground'>{pendingDelete?.name}</span> will be removed,
              along with the crew assignments linking them to films. This cannot be undone.
            </>
          )
        }
        confirmLabel={pendingDelete?.kind === 'role' ? 'Delete role' : 'Delete crew member'}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </main>
  );
}

