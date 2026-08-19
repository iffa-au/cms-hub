import type { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type CrewEntry = {
  fullName: string;
  role?: string;
  biography?: string;
  instagramUrl?: string;
  imageUrl?: string;
  email?: string;
};

export type SubmissionOverview = {
  _id: string;
  creatorId?: string;
  title: string;
  synopsis?: string;
  releaseDate?: string;
  potraitImageUrl?: string;
  landscapeImageUrl?: string;
  status?: string;
  imdbUrl?: string;
  trailerUrl?: string;
  releaseLinkUrl?: string;
  contactEmail?: string;
  productionHouse?: string;
  distributor?: string;
  isFeatured?: boolean;
  languageId?: string;
  countryId?: string;
  contentTypeId?: string;
  genreIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  contentType?: { _id: string; name: string };
  language?: { _id: string; name: string };
  country?: { _id: string; name: string };
  releaseCountries?: Array<{ _id: string; name: string }>;
  watchFormats?: string[];
  notes?: string;
  genres?: Array<{ _id: string; name: string }>;
  crew?: {
    actors?: CrewEntry[];
    directors?: CrewEntry[];
    producers?: CrewEntry[];
    other?: CrewEntry[];
  };
};

// Submission list PDF row
export type SubmissionListRow = {
  title?: string;
  createdAt?: string;
  contactEmail?: string;
};

const WATCH_FORMAT_LABELS: Record<string, string> = {
  theatrical: 'Theatrical',
  ott: 'OTT / Streaming',
  tv: 'TV',
  festival: 'Festival only',
  other: 'Other',
};

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

const formatWatchFormats = (formats?: string[]) => {
  if (!formats || formats.length === 0) return '—';
  return formats
    .map((format) => WATCH_FORMAT_LABELS[format] || format)
    .join(', ');
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

// parse submission date to ISO format
const formatSubmissionDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB');
};

const valueOrDash = (value?: string | null) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || '—';
};

const wrapUrl = (value?: string) => {
  const text = valueOrDash(value);
  if (text === '—') return text;
  // Hard-wrap long URLs so content always stays inside narrow cells.
  return text.replace(/(.{1,26})(?=.)/g, '$1\n');
};

export const sanitizeSubmissionFileName = (title?: string) => {
  const normalized = (title || 'submission')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'submission';
};

export const buildSubmissionPdf = (doc: jsPDF, details: SubmissionOverview) => {
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (required = 24) => {
    if (y + required > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, margin, y);
    y += 18;
  };

  const addField = (label: string, value?: string) => {
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, margin, y);

    doc.setFont('helvetica', 'normal');
    const text = value?.trim() ? value : '—';
    const lines = doc.splitTextToSize(text, maxWidth - 110);
    doc.text(lines, margin + 110, y);
    y += Math.max(16, lines.length * 13);
  };

  const addLinkField = (label: string, url?: string) => {
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, margin, y);

    const text = url?.trim() || '—';
    const xStart = margin + 110;
    const lineHeight = 13;

    if (text === '—') {
      doc.setFont('helvetica', 'normal');
      doc.text(text, xStart, y);
      y += 16;
      return;
    }

    const lines = doc.splitTextToSize(text, maxWidth - 110);
    const blockHeight = Math.max(16, lines.length * lineHeight);

    // Draw text in blue/underlined style to signal it's clickable
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 235);
    doc.text(lines, xStart, y);
    doc.setTextColor(0, 0, 0);

    // Single link annotation covering the full wrapped text block
    // so clicking anywhere on the text opens the complete URL
    const textWidth = maxWidth - 110;
    doc.link(xStart, y - 10, textWidth, blockHeight, { url: text });

    y += blockHeight;
  };

  const addParagraph = (label: string, value?: string) => {
    ensureSpace(36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, margin, y);
    y += 12;

    doc.setFont('helvetica', 'normal');
    const text = value?.trim() ? value : '—';
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, margin, y);
    y += Math.max(16, lines.length * 13);
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(details.title || 'Submission Details', margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y);
  y += 18;

  addSectionTitle('Film Information');
  addField('Title', details.title);
  addParagraph('Synopsis', details.synopsis);
  addField('Release Date', formatDate(details.releaseDate));
  addField('Status', details.status);
  addField(
    'Featured',
    details.isFeatured === undefined ? '—' : details.isFeatured ? 'Yes' : 'No',
  );
  addField('Production House', details.productionHouse || '—');
  addField('Distributor', details.distributor || '—');
  addField('Submitter Email', details.contactEmail || '—');
  addLinkField('IMDB URL', details.imdbUrl);
  addLinkField('Trailer Download URL', details.trailerUrl);
  addLinkField('Release, Broadcast or Exhibition Link', details.releaseLinkUrl);
  addLinkField('Portrait Image', details.potraitImageUrl);
  addLinkField('Landscape Image', details.landscapeImageUrl);

  y += 8;
  addSectionTitle('Metadata');
  addField('Content Type', valueOrDash(details.contentType?.name));
  addField('Primary Language', valueOrDash(details.language?.name));
  addField('Country of Origin', valueOrDash(details.country?.name));
  addField(
    'Countries of Release',
    details.releaseCountries && details.releaseCountries.length > 0
      ? details.releaseCountries.map((country) => valueOrDash(country.name)).join(', ')
      : '—',
  );
  addField('Watch Formats', formatWatchFormats(details.watchFormats));
  addField(
    'Genres',
    details.genres && details.genres.length > 0
      ? details.genres.map((genre) => valueOrDash(genre.name)).join(', ')
      : '—',
  );

  y += 8;
  addSectionTitle('Additional Notes');
  addParagraph('Notes', details.notes);

  y += 8;
  addSectionTitle('Submission Timeline');
  addField('Submitted At', formatDateTime(details.createdAt));
  addField('Last Updated', formatDate(details.updatedAt));

  const crewGroups: Array<{ title: string; entries?: CrewEntry[] }> = [
    { title: 'Actors', entries: details.crew?.actors },
    { title: 'Directors', entries: details.crew?.directors },
    { title: 'Producers', entries: details.crew?.producers },
    { title: 'Other Crew', entries: details.crew?.other },
  ];

  for (const group of crewGroups) {
    y += 8;
    addSectionTitle(`Crew - ${group.title}`);

    // Keep raw URLs per row so we can attach link annotations in didDrawCell
    const rawUrls: Array<{ instagram?: string; imageUrl?: string }> = [];

    const rows =
      group.entries && group.entries.length > 0
        ? group.entries.map((entry, i) => {
            rawUrls[i] = {
              instagram: entry.instagramUrl?.trim() || undefined,
              imageUrl: entry.imageUrl?.trim() || undefined,
            };
            return [
              entry.fullName || '—',
              entry.role || '—',
              valueOrDash(entry.biography),
              wrapUrl(entry.instagramUrl),
              wrapUrl(entry.imageUrl),
              valueOrDash(entry.email),
            ];
          })
        : [['—', '—', 'No submitted entries', '—', '—', '—']];

    const columnWidths = {
      0: maxWidth * 0.14, // Name
      1: maxWidth * 0.08, // Role
      2: maxWidth * 0.32, // Biography
      3: maxWidth * 0.12, // Instagram
      4: maxWidth * 0.14, // Image URL
      5: maxWidth * 0.2,  // Email
    };

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Name', 'Role', 'Biography', 'Instagram', 'Image URL', 'Email']],
      body: rows,
      theme: 'grid',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      tableWidth: maxWidth,
      styles: {
        fontSize: 9,
        cellPadding: 5,
        overflow: 'linebreak',
        valign: 'top',
        lineColor: [215, 220, 228],
        lineWidth: 0.35,
      },
      headStyles: {
        fontStyle: 'bold',
        fillColor: [40, 56, 86],
        textColor: 255,
        valign: 'middle',
      },
      bodyStyles: {
        textColor: [35, 35, 35],
      },
      alternateRowStyles: {
        fillColor: [247, 249, 252],
      },
      columnStyles: {
        0: { cellWidth: columnWidths[0], overflow: 'linebreak' },
        1: { cellWidth: columnWidths[1], overflow: 'linebreak' },
        2: { cellWidth: columnWidths[2], overflow: 'linebreak' },
        3: { cellWidth: columnWidths[3], overflow: 'linebreak' },
        4: { cellWidth: columnWidths[4], overflow: 'linebreak' },
        5: { cellWidth: columnWidths[5], overflow: 'linebreak' },
      },
      // Colour URL cells blue before drawing text
      willDrawCell: (data) => {
        if (data.section !== 'body') return;
        const colIdx = data.column.index;
        if (colIdx !== 3 && colIdx !== 4) return;
        const urls = rawUrls[data.row.index];
        const url = colIdx === 3 ? urls?.instagram : urls?.imageUrl;
        if (url) doc.setTextColor(37, 99, 235);
      },
      // Add clickable link annotation covering the full cell, then reset colour
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        const colIdx = data.column.index;
        if (colIdx !== 3 && colIdx !== 4) return;
        doc.setTextColor(35, 35, 35);
        const urls = rawUrls[data.row.index];
        const url = colIdx === 3 ? urls?.instagram : urls?.imageUrl;
        if (url) {
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
        }
      },
    });
    y =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY || y) + 14;
  }
};

// build submission list PDF
export const buildSubmissionListPdf = (doc: jsPDF, rows: SubmissionListRow[]) => {
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Review Queue Submissions', margin, margin);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Exported: ${new Date().toLocaleString()}`, margin, margin + 18);

  const body =
    rows.length > 0
      ? rows.map((row, idx) => [
          String(idx + 1),
          valueOrDash(row.title),
          valueOrDash(row.contactEmail),
          formatSubmissionDate(row.createdAt),
        ])
      : [['—', 'No submissions found', '—', '—']];

  autoTable(doc, {
    startY: margin + 34,
    margin: { left: margin, right: margin },
    head: [['No.', 'Film Title', 'Submitter Email', 'Submission Date']],
    body,
    theme: 'grid',
    tableWidth: maxWidth,
    styles: {
      fontSize: 10,
      cellPadding: 6,
      overflow: 'linebreak',
      lineColor: [215, 220, 228],
      lineWidth: 0.35,
    },
    headStyles: {
      fontStyle: 'bold',
      fillColor: [40, 56, 86],
      textColor: 255,
    },
    columnStyles: {
      0: { cellWidth: 56, halign: 'center' },
      1: { cellWidth: maxWidth - 170 - 140 },
      2: { cellWidth: 140 },
      3: { cellWidth: 114 },
    },
  });
};
