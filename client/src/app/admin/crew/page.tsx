'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteData, getData, postData } from '@/lib/fetch-util';
import { Search, X } from 'lucide-react';

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

  const deleteRole = async (id: string) => {
    try {
      await deleteData(`/crew-roles/${id}`);
      await loadAll();
    } catch {
      // ignore errors for now
    }
  };

  const deleteMember = async (id: string) => {
    try {
      await deleteData(`/crew-members/${id}`);
      await loadAll();
    } catch {
      // ignore errors for now
    }
  };

  return (
    <main className='flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full'>
      <div className='flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4'>
        <div>
          <h1 className='font-serif text-3xl md:text-4xl text-white mb-2'>Crew Directory</h1>
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

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Left: Crew list */}
        <section className='lg:col-span-2 rounded border border-border bg-surface-dark h-[520px] flex flex-col overflow-hidden'>
          <div className='px-6 py-4 border-b border-border'>
            <h3 className='text-white text-sm font-bold tracking-widest uppercase font-serif'>All Crew Members</h3>
          </div>
          <div className='divide-y divide-border flex-1 overflow-y-auto min-h-0'>
            {loading ? (
              <div className='p-6 text-sm text-muted-foreground'>Loading…</div>
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
                      className='text-primary hover:text-foreground transition-colors text-[10px] font-bold tracking-widest'
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => void deleteMember(m._id)}
                      className='text-red-500 hover:text-red-400 transition-colors text-[10px] font-bold tracking-widest'
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
            <h3 className='text-white text-sm font-bold tracking-widest uppercase font-serif'>Crew Roles</h3>
          </div>
          <div className='p-6 space-y-4 flex-1 flex flex-col min-h-0'>
            <div>
              <label className='text-accent-foreground text-xs font-bold uppercase tracking-widest'>Role Name</label>
              <input
                className='w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2'
                placeholder='e.g. Director'
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
              />
            </div>
            <div>
              <label className='text-accent-foreground text-xs font-bold uppercase tracking-widest'>Description</label>
              <textarea
                className='w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2 resize-none'
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
                      onClick={() => void deleteRole(r._id)}
                      className='text-red-500 hover:text-red-400 transition-colors text-[10px] font-bold tracking-widest'
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
    </main>
  );
}

