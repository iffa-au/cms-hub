'use client';

import { getData } from '@/lib/fetch-util';
import {
  buildSubmissionPdf,
  sanitizeSubmissionFileName,
  type SubmissionOverview,
} from '@/lib/submission-pdf';
import { useState } from 'react';

type OverviewResponse = {
  success: boolean;
  data: SubmissionOverview;
  message?: string;
};

type DownloadPdfButtonProps = {
  submissionId: string;
  onError: (message: string) => void;
};

export default function DownloadPdfButton({
  submissionId,
  onError,
}: DownloadPdfButtonProps) {
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

  const onDownload = async () => {
    try {
      onError('');
      setIsDownloading(true);
      const response = await getData<OverviewResponse>(
        `/submissions/${submissionId}/overview?expand=meta`,
      );
      const details = response?.data;
      if (!details) {
        throw new Error('Submission details are unavailable');
      }

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      buildSubmissionPdf(doc, details);

      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${sanitizeSubmissionFileName(details.title)}_${details._id}_${timestamp}.pdf`;
      doc.save(fileName);
    } catch (e: unknown) {
      onError(getErrorMessage(e, 'Failed to generate PDF'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={() => void onDownload()}
      disabled={isDownloading}
      className='text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[10px] font-bold tracking-widest'
    >
      {isDownloading ? 'DOWNLOADING...' : 'DOWNLOAD PDF'}
    </button>
  );
}
