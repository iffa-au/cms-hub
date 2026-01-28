'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/auth-context';
import { getData, updateData } from '@/lib/fetch-util';
import { useEffect } from 'react';

const INPUT =
  'w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2';
const LABEL = 'text-accent-foreground text-xs font-bold uppercase tracking-widest';

export default function ProfilePage() {
  const { user } = useAuth();
  const [name, setName] = useState<string>(user?.name ?? '');
  const [email, setEmail] = useState<string>(user?.email ?? '');
  const [role, setRole] = useState<string>(user?.role ?? '');
  const [bio, setBio] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load current profile from backend to ensure bio and name are in sync
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getData<{ success: boolean; data?: { name?: string; fullName?: string; email: string; role: string; bio?: string } }>('/users/me');
        if (!cancelled && res?.success && res.data) {
          console.log('res.data', res.data);
          setName(res.data.fullName ?? res.data.name ?? '');
          setEmail(res.data.email ?? '');
          setRole(res.data.role ?? '');
          setBio(res.data.bio ?? '');
        }
      } catch {
        // ignore load errors; keep existing auth state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await updateData<{
        success: boolean;
        data?: { id: string; email: string; name: string; role: string; bio?: string };
        message?: string;
      }>('/users/me', { fullName: name, bio });
      if ((res as any)?.success) {
        // Update localStorage for future restores
        try {
          const updatedUser = { id: res.data?.id, email: res.data?.email, name: res.data?.name, role: res.data?.role };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        } catch {
          // ignore storage errors
        }

        setSuccess('Profile updated.');
        // reflect saved values locally
        setName(res.data?.name ?? name);
        setBio(res.data?.bio ?? bio);
        setEmail(res.data?.email ?? email);
        setRole(res.data?.role ?? role);
      } else {
        setError((res as any)?.message || 'Failed to update profile.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className='flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full'>
      <div className='flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4'>
        <div>
          <h1 className='font-serif text-3xl md:text-4xl text-white mb-2'>Account Profile</h1>
          <p className='text-accent-foreground text-sm'>Manage your personal info and credentials.</p>
        </div>
      </div>

      <section className='rounded-xl border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50'>
        <div className='px-8 py-6 border-b border-border flex justify-between items-center bg-surface-dark'>
          <h3 className='text-white text-lg font-bold tracking-widest uppercase font-serif'>Basic Information</h3>
        </div>
        <div className='p-8 grid grid-cols-1 md:grid-cols-2 gap-8'>
          <div className='space-y-2'>
            <label className={LABEL}>Full Name</label>
            <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder='Your name' />
          </div>
          <div className='space-y-2'>
            <label className={LABEL}>Email</label>
            <input className={INPUT} value={email} disabled />
          </div>
          <div className='space-y-2'>
            <label className={LABEL}>Role</label>
            <input className={INPUT} value={role} disabled />
          </div>
          <div className='space-y-2 md:col-span-2'>
            <label className={LABEL}>Bio</label>
            <textarea
              className='w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none mt-2'
              rows={5}
              placeholder='Tell us a bit about yourself...'
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          {error ? <p className='text-red-500 text-sm md:col-span-2'>{error}</p> : null}
          {success ? <p className='text-green-500 text-sm md:col-span-2'>{success}</p> : null}
          <div className='md:col-span-2 flex justify-end'>
            <button
              onClick={() => void onSave()}
              disabled={saving}
              className='px-8 py-3 rounded bg-primary text-black hover:bg-[#d9a50b] font-bold shadow-[0_0_20px_rgba(242,185,13,0.1)] hover:shadow-[0_0_30px_rgba(242,185,13,0.3)] transition-all duration-300 uppercase tracking-widest text-xs disabled:opacity-60 disabled:cursor-not-allowed'
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
