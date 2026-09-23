import type { jsPDF } from 'jspdf';

/**
 * One film enquiry as a PDF. Laid out to match `buildSubmissionPdf` in
 * submission-pdf.ts — same fonts, section headings and label column — so a
 * reviewer handling both gets one consistent document style.
 *
 * Built from the enquiry the detail page already loaded; no second fetch.
 */

type Ref = { _id: string; name?: string };

export type FilmEnquiryPdfData = {
  _id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  synopsis: string;
  productionHouse: string;
  distributor?: string;
  releaseDate: string;
  trailerUrl: string;
  contentType?: Ref;
  genreIds?: Ref[];
  country?: Ref;
  language?: Ref;
  releaseCountryIds?: Ref[];
  watchFormats?: string[];
  createdAt?: string;
};

const WATCH_FORMAT_LABELS: Record<string, string> = {
  theatrical: 'Theatrical',
  ott: 'OTT / Streaming',
  tv: 'TV',
  festival: 'Festival only',
  other: 'Other',
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};

const names = (refs?: Ref[]) =>
  (Array.isArray(refs) ? refs : [])
    .map((r) => (r && typeof r === 'object' ? r.name : undefined))
    .filter(Boolean)
    .join(', ') || '—';

export const filmEnquiryPdfFileName = (enquiry: FilmEnquiryPdfData) => {
  const slug =
    (enquiry.title || 'enquiry')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'enquiry';
  const date = new Date().toISOString().slice(0, 10);
  return `enquiry_${slug}_${date}.pdf`;
};

export const buildFilmEnquiryPdf = (doc: jsPDF, enquiry: FilmEnquiryPdfData) => {
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const LABEL_COL = 130;
  const LINE_HEIGHT = 13;
  let y = margin;

  const ensureSpace = (required = 24) => {
    if (y + required > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addSectionTitle = (title: string) => {
    y += 8;
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, margin, y);
    y += 18;
  };

  // Same rule as the submission PDF: a label too wide for its column puts
  // its value on the next line instead of printing over it.
  const drawLabel = (label: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, margin, y);
    const wraps = doc.getTextWidth(`${label}:`) + 8 > LABEL_COL;
    if (wraps) y += LINE_HEIGHT;
    return {
      x: wraps ? margin : margin + LABEL_COL,
      width: wraps ? maxWidth : maxWidth - LABEL_COL,
    };
  };

  const addField = (label: string, value?: string) => {
    ensureSpace(24 + LINE_HEIGHT);
    const { x, width } = drawLabel(label);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value?.trim() || '—', width);
    doc.text(lines, x, y);
    y += Math.max(16, lines.length * LINE_HEIGHT);
  };

  const addLinkField = (label: string, url?: string) => {
    const text = url?.trim();
    if (!text) return addField(label, '—');
    ensureSpace(24 + LINE_HEIGHT);
    const { x, width } = drawLabel(label);
    const lines = doc.splitTextToSize(text, width);
    const blockHeight = Math.max(16, lines.length * LINE_HEIGHT);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 235);
    doc.text(lines, x, y);
    doc.setTextColor(0, 0, 0);
    doc.link(x, y - 10, width, blockHeight, { url: text });
    y += blockHeight;
  };

  const addParagraph = (label: string, value?: string) => {
    ensureSpace(36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value?.trim() || '—', maxWidth);
    // Long synopses can outrun the page; print line by line so they break.
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, margin, y);
      y += LINE_HEIGHT;
    }
    y += 3;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(enquiry.title || 'Film enquiry', maxWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Film enquiry, exported ${new Date().toLocaleString()}`, margin, y);
  y += 10;

  addSectionTitle('Contact');
  addField('Name', enquiry.name);
  addField('Role', enquiry.role);
  addField('Email', enquiry.email);

  addSectionTitle('Film Information');
  addField('Title', enquiry.title);
  addParagraph('Synopsis', enquiry.synopsis);
  addField('Release Date', formatDate(enquiry.releaseDate));
  addField('Production House', enquiry.productionHouse);
  addField('Distributor', enquiry.distributor);
  addLinkField('Trailer Download URL', enquiry.trailerUrl);

  addSectionTitle('Metadata');
  addField('Content Type', enquiry.contentType?.name);
  addField('Genres', names(enquiry.genreIds));
  addField('Language', enquiry.language?.name);
  addField('Country of Origin', enquiry.country?.name);
  addField('Countries of Release', names(enquiry.releaseCountryIds));
  addField(
    'Watch Formats',
    (enquiry.watchFormats || []).map((f) => WATCH_FORMAT_LABELS[f] || f).join(', '),
  );

  addSectionTitle('Timeline');
  addField('Submitted', formatDate(enquiry.createdAt));
};
