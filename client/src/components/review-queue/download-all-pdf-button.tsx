'use client';

import { getData } from '@/lib/fetch-util';
import { buildSubmissionListPdf, type SubmissionListRow } from '@/lib/submission-pdf';
import { useState } from 'react';

type ListResponse = {
  success: boolean;
  data: SubmissionListRow[];
  meta?: { page: number; limit: number; total: number };
  message?: string;
};

type DownloadAllPdfButtonProps = {
  query: string;
  onError: (message: string) => void;
};

const PAGE_SIZE = 100;

export default function DownloadAllPdfButton({ query, onError }: DownloadAllPdfButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const getErrorMessage = (value: unknown, fallback: string) => {
    if (value instanceof Error && value.message) return value.message;
    if (
      typeof value === 'object' &&
      value &&
      'message' in value &&
      typeof (value as { message?: unknown }).message === 'string'
    ) {
      return String((value as { message?: string }).message);
    }
    return fallback;
  };

  const fetchAllSubmitted = async () => {
    const allRows: SubmissionListRow[] = [];
    let page = 1;
    let total = 0;

    while (true) {
      const parts = [`page=${page}`, `limit=${PAGE_SIZE}`, `status=SUBMITTED`];
      if (query.trim()) {
        parts.push(`q=${encodeURIComponent(query.trim())}`);
      }

      const response = await getData<ListResponse>(`/submissions?${parts.join('&')}`);
      const pageRows = response?.data ?? [];
      const meta = response?.meta;

      allRows.push(...pageRows);
      total = meta?.total ?? allRows.length;

      const reachedEndByCount = allRows.length >= total;
      const reachedEndByPageSize = pageRows.length < PAGE_SIZE;
      if (reachedEndByCount || reachedEndByPageSize) break;

      page += 1;
    }

    return allRows;
  };

  const onDownload = async () => {
    try {
      onError('');
      setIsDownloading(true);

      const rows = await fetchAllSubmitted();
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      buildSubmissionListPdf(doc, rows);

      const timestamp = new Date().toISOString().slice(0, 10);
      doc.save(`review_queue_submissions_${timestamp}.pdf`);
    } catch (e: unknown) {
      onError(getErrorMessage(e, 'Failed to download all submissions'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={() => void onDownload()}
      disabled={isDownloading}
      className='bg-primary text-primary-foreground px-4 py-2 rounded text-xs font-bold tracking-widest hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed'
    >
      {isDownloading ? 'DOWNLOADING...' : 'DOWNLOAD ALL PDF'}
    </button>
  );
}
