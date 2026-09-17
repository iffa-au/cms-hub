'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getData } from '@/lib/fetch-util';
import CrewEditor, { EMPTY_CREW, toCrewGroups, type CrewGroups } from './crew-editor';

type CrewModalProps = {
  submissionId: string;
  title: string;
  onClose: () => void;
};

/**
 * Loads a submission's crew on open rather than relying on the list response,
 * which doesn't project it.
 *
 * Deliberately uses GET /submissions/:id and not /:id/overview?expand=crew —
 * that flag makes the backend replace the grouped crew object with the legacy
 * crew-assignment array, which is a different shape and, for 2026 films,
 * always empty.
 */
export default function CrewModal({ submissionId, title, onClose }: CrewModalProps) {
  const [crew, setCrew] = useState<CrewGroups | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // This route returns the document directly on some paths and wrapped
        // in { data } on others, so accept both rather than guessing.
        const res = await getData<{ crew?: unknown; data?: { crew?: unknown } }>(
          `/submissions/${submissionId}`,
        );
        if (cancelled) return;
        setCrew(toCrewGroups(res?.data?.crew ?? res?.crew));
      } catch {
        if (!cancelled) setError('Could not load crew for this submission.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className='fixed inset-0 z-50 bg-black/45 backdrop-blur-sm px-4 py-8 overflow-y-auto'
      onClick={onClose}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-label={`Crew for ${title}`}
        className='mx-auto max-w-4xl bg-card border border-border rounded-lg p-5 md:p-7'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-start justify-between gap-4 mb-6'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold text-muted-foreground'>
              Editing crew for
            </p>
            <h2 className='text-white text-xl font-serif font-bold truncate'>{title}</h2>
          </div>
          <button
            onClick={onClose}
            className='text-muted-foreground hover:text-primary shrink-0'
            aria-label='Close'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        {error ? (
          <p className='text-sm text-red-400'>{error}</p>
        ) : crew === null ? (
          <p className='text-sm text-muted-foreground'>Loading crew…</p>
        ) : (
          <CrewEditor
            submissionId={submissionId}
            initialCrew={crew ?? EMPTY_CREW}
            heading='Crew'
          />
        )}
      </div>
    </div>
  );
}
