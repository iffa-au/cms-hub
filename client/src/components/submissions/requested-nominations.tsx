import { Users } from 'lucide-react';
import type { RequestedNomination } from '@/lib/submission-pdf';

const GROUP_LABELS: Record<RequestedNomination['nominees'][number]['group'], string> = {
  actors: 'Actor',
  directors: 'Director',
  producers: 'Producer',
  other: 'Crew',
};

/**
 * The awards the submitter asked to be considered for on the public form,
 * one row per category with its nominees. Read-only: these are requests, and
 * the festival's own nominations are created separately on the Nominate page.
 *
 * Shared by the submission view and the Nominate page so the two can't drift
 * into showing the same request differently. `onUse`, when given, adds a
 * button per row — the Nominate page uses it to prefill its form.
 */
export default function RequestedNominations({
  nominations,
  onUse,
}: {
  nominations: RequestedNomination[];
  onUse?: (nomination: RequestedNomination) => void;
}) {
  if (nominations.length === 0) {
    return <p className='text-muted-foreground text-sm'>The submitter didn&apos;t request any nominations.</p>;
  }

  return (
    <ul className='grid grid-cols-1 gap-3'>
      {nominations.map((n) => (
        <li
          key={n.awardCategoryId}
          className='rounded-lg border border-border p-4 text-sm flex flex-col sm:flex-row sm:items-start gap-3'
        >
          <div className='min-w-0 flex-1'>
            <p className='text-white font-medium'>{n.categoryName}</p>
            <div className='mt-2 flex flex-wrap gap-2'>
              {n.wholeTeam || n.nominees.length === 0 ? (
                <span className='inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs text-white'>
                  <Users className='h-3 w-3 text-primary' /> Whole team
                </span>
              ) : (
                n.nominees.map((p) => (
                  <span
                    key={`${p.group}-${p.fullName}`}
                    className='rounded-full border border-border px-2.5 py-0.5 text-xs text-white'
                  >
                    {p.fullName}
                    <span className='text-muted-foreground'>
                      {' '}
                      · {p.role?.trim() || GROUP_LABELS[p.group]}
                    </span>
                  </span>
                ))
              )}
            </div>
          </div>
          {onUse && (
            <button
              type='button'
              onClick={() => onUse(n)}
              className='self-start rounded border border-border px-3 py-1.5 text-xs font-bold tracking-widest text-foreground hover:border-primary transition-colors'
            >
              USE
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
