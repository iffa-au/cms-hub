import type { jsPDF } from 'jspdf';
import { APPLICATION_STATUS_LABELS, type TalentLabApplication } from '@/lib/talent-lab';

/**
 * One Talent Lab application as a PDF, laid out like the film enquiry and
 * submission PDFs (same fonts, section headings and label column).
 *
 * Deliberately leaves out the three private answers (access requirements,
 * First Nations, regional/remote). The Apply form promises they are never
 * used in assessment, and a PDF is exactly the kind of thing that gets passed
 * to an assessment panel. Staff notes are left out for the same reason: the
 * PDF may be shared beyond the staff who wrote them.
 */

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const applicationPdfFileName = (a: TalentLabApplication) => {
  const slug =
    (a.fullName || 'applicant')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'applicant';
  return `talent_lab_${a.reference}_${slug}.pdf`;
};

export const buildApplicationPdf = (doc: jsPDF, a: TalentLabApplication) => {
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

  const drawLabel = (label: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, margin, y);
    const wraps = doc.getTextWidth(`${label}:`) + 8 > LABEL_COL;
    if (wraps) y += LINE_HEIGHT;
    return { x: wraps ? margin : margin + LABEL_COL, width: wraps ? maxWidth : maxWidth - LABEL_COL };
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
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, margin, y);
      y += LINE_HEIGHT;
    }
    y += 3;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(a.fullName || 'Talent Lab application', maxWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Talent Lab application ${a.reference}, exported ${new Date().toLocaleString()}`, margin, y);
  y += 10;

  addSectionTitle('Application');
  addField('Reference', a.reference);
  addField('Program', a.program);
  addField('Status', APPLICATION_STATUS_LABELS[a.status] ?? a.status);
  addField('Received', formatDate(a.createdAt));

  addSectionTitle('Contact');
  addField('Email', a.email);
  addField('Phone', a.phone);
  addField('Location', a.location);

  addSectionTitle('Profile');
  addField('Primary discipline', a.primaryDiscipline);
  addField('Secondary discipline', a.secondaryDiscipline);
  addField('Career stage', a.careerStage);
  addParagraph('Biography', a.biography);
  addParagraph('Career objective', a.careerObjective);

  addSectionTitle('Project & motivation');
  addParagraph('Project or portfolio', a.projectDescription);
  addParagraph('Why this program', a.whyThisProgram);
  addLinkField('Portfolio link', a.portfolioLink);
  addField('Availability', a.availability);
  addParagraph('Previous programs', a.previousPrograms);

  addSectionTitle('Consents');
  const c = a.consents;
  addField('Terms', c?.terms ? 'Agreed' : 'Not agreed');
  addField('Code of conduct', c?.conduct ? 'Agreed' : 'Not agreed');
  addField('Privacy', c?.privacy ? 'Agreed' : 'Not agreed');
  addField('Media use', c?.media ? 'Agreed' : 'Not agreed');
};
