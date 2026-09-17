'use client';

import { useEffect, useState } from 'react';
import { getData } from '@/lib/fetch-util';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-context';
import PageShell from '@/components/page-shell';
import RecordList, { type Column } from '@/components/record-list';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/status';

type ContentType = { _id: string; name: string };
type Nomination = {
  _id: string;
  submissionId: string;
  submissionTitle?: string | null;
  submissionSynopsis?: string | null;
  year: number;
  isWinner: boolean;
  crewMemberName?: string | null;
};

type ListResponse = {
  success: boolean;
  data: Nomination[];
  meta?: { page: number; limit: number; total: number };
};

export default function NominationListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [items, setItems] = useState<Nomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMeta, setPageMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

  // Restrict to admin/staff
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'staff') {
      router.replace('/dashboard');
    }
  }, [router, user]);

  // filters
  const [contentTypeId, setContentTypeId] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [winnerOnly, setWinnerOnly] = useState<boolean>(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const qs = [
        'page=1',
        'limit=20',
        ...(contentTypeId ? [`contentTypeId=${encodeURIComponent(contentTypeId)}`] : []),
        ...(year.trim() ? [`year=${encodeURIComponent(year.trim())}`] : []),
        ...(winnerOnly ? ['isWinner=true'] : []),
      ].join('&');
      const res = await getData<ListResponse>(`/nominations?${qs}`);
      setItems(res?.data ?? []);
      setPageMeta(res?.meta ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load nominations');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const ct = await getData<{ success: boolean; data: ContentType[] }>(`/content-types`);
        setContentTypes(ct?.data ?? []);
      } catch {
        // ignore
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showingStart = items.length === 0 ? 0 : 1;
  const showingEnd = items.length;
  const total = pageMeta?.total ?? items.length;

  const columns: Column<Nomination>[] = [
    {
      key: 'title',
      header: 'Film',
      role: 'title',
      cell: (n) => (
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg text-foreground">
            {n.submissionTitle || '\u2014'}
          </h3>
          <p className="line-clamp-1 max-w-xl text-xs text-muted-foreground">
            {n.submissionSynopsis || '\u2014'}
          </p>
        </div>
      ),
    },
    {
      key: 'year',
      header: 'Edition',
      align: 'center',
      cell: (n) => <span className="font-mono text-xs text-muted-foreground">{n.year}</span>,
    },
    {
      key: 'crew',
      header: 'Nominee',
      cell: (n) => (
        <span className="text-foreground/80">{n.crewMemberName || 'Whole production'}</span>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      role: 'cardHidden',
      cell: (n) => <StatusChip status={n.isWinner ? 'WINNER' : 'NOMINATED'} />,
    },
  ];

  return (
    <PageShell
      title="Award nominations"
      description="Every nomination and win across all festival editions."
    >
      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface-dark p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nom-type" className="text-xs text-muted-foreground">
            Content type
          </label>
          <select
            id="nom-type"
            className="rounded border border-border bg-background px-3 py-2.5 text-sm text-foreground"
            value={contentTypeId}
            onChange={(e) => setContentTypeId(e.target.value)}
          >
            <option value="">All</option>
            {contentTypes.map((ct) => (
              <option key={ct._id} value={ct._id}>
                {ct.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nom-year" className="text-xs text-muted-foreground">
            Edition year
          </label>
          <input
            id="nom-year"
            className="rounded border border-border bg-background px-3 py-2.5 text-sm text-foreground"
            placeholder="e.g. 2026"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 py-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={winnerOnly}
              onChange={(e) => setWinnerOnly(e.target.checked)}
            />
            Winners only
          </label>
        </div>

        <div className="flex items-end gap-2">
          <Button onClick={() => void load()}>Apply</Button>
          <Button
            variant="outline"
            onClick={() => {
              setContentTypeId('');
              setYear('');
              setWinnerOnly(false);
              void load();
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <RecordList
        items={items}
        columns={columns}
        getKey={(n) => n._id}
        getStatus={(n) => (n.isWinner ? 'WINNER' : 'NOMINATED')}
        loading={loading}
        error={error}
        empty="No nominations match these filters."
        actions={(n) => (
          <Button
            variant="rowAction"
            size="inline"
            onClick={() => router.push(`/submissions/${n.submissionId}/nomination`)}
          >
            Manage
          </Button>
        )}
      />

      <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
        {`Showing ${showingStart}\u2013${showingEnd} of ${total} nominations`}
      </p>
    </PageShell>
  );
}
