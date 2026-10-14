import PDFDocument from 'pdfkit';
import { formatDisplayDate, todayInSchoolTz } from '../../utils/dates.js';
import { PDF_COLORS as COLORS, drawImage, drawSchoolHeader, pdfFileName } from '../../utils/pdfBranding.js';

const MARGIN = 36;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - MARGIN - 24;

const TABLE_COLUMNS = [
  { key: 'index', label: '#', width: 22, align: 'center' },
  { key: 'subject', label: 'SUBJECT', width: 132, align: 'left' },
  { key: 'marks', label: 'MARKS', width: 56, align: 'center' },
  { key: 'percentage', label: '%', width: 44, align: 'center' },
  { key: 'grade', label: 'GRADE', width: 38, align: 'center' },
  { key: 'points', label: 'POINTS', width: 40, align: 'center' },
  { key: 'remarks', label: 'REMARKS', width: 111, align: 'left' },
  { key: 'teacher', label: 'SUBJECT TEACHER', width: CONTENT_WIDTH - 443, align: 'left' },
];

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(decimals).replace(/\.?0+$/, '');
};

export function createReportDocument(title, schoolName) {
  return new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    info: { Title: title, Author: schoolName, Creator: `${schoolName} School Management System` },
  });
}

function drawTitle(doc, y, exam) {
  doc.rect(MARGIN, y, CONTENT_WIDTH, 34).fill(COLORS.navy);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.white)
    .text('STUDENT ACADEMIC PROGRESS REPORT', MARGIN, y + 6, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 0.8 });
  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.steelLight)
    .text(`${exam.name}   •   ${exam.termName}   •   Academic Year ${exam.yearLabel}`, MARGIN, y + 21, {
      width: CONTENT_WIDTH, align: 'center',
    });
  return y + 44;
}

function drawCell(doc, x, y, width, height, label, value) {
  doc.rect(x, y, width, height).lineWidth(0.6).strokeColor(COLORS.border).stroke();
  doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted)
    .text(label.toUpperCase(), x + 6, y + 5, { width: width - 12, characterSpacing: 0.4, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text)
    .text(String(value ?? '-'), x + 6, y + 15, { width: width - 12, height: 12, ellipsis: true, lineBreak: false });
}

function drawInfoGrid(doc, y, data) {
  const { student, result } = data;
  const col = CONTENT_WIDTH / 4;
  const rowHeight = 30;
  const position = result?.classPosition ? `${result.classPosition} out of ${result.classSize}` : '-';
  const streamPosition = result?.streamPosition && student.streamName
    ? `${result.streamPosition} out of ${result.streamSize}`
    : '-';
  const classLabel = student.streamName ? `${student.className} ${student.streamName}` : student.className;

  drawCell(doc, MARGIN, y, col, rowHeight, 'Registration No.', student.registrationNumber);
  drawCell(doc, MARGIN + col, y, col * 2, rowHeight, 'Student Name', student.fullName.toUpperCase());
  drawCell(doc, MARGIN + col * 3, y, col, rowHeight, 'Gender', student.gender === 'male' ? 'Male' : 'Female');
  const row2 = y + rowHeight;
  drawCell(doc, MARGIN, row2, col, rowHeight, 'Class / Stream', classLabel);
  drawCell(doc, MARGIN + col, row2, col, rowHeight, 'Position in Class', position);
  drawCell(doc, MARGIN + col * 2, row2, col, rowHeight, 'Position in Stream', streamPosition);
  drawCell(doc, MARGIN + col * 3, row2, col, rowHeight, 'Total Students', result?.classSize ?? '-');
  return row2 + rowHeight + 12;
}

function drawTableRow(doc, y, height, values, { header = false, shaded = false } = {}) {
  if (header) doc.rect(MARGIN, y, CONTENT_WIDTH, height).fill(COLORS.navy);
  else if (shaded) doc.rect(MARGIN, y, CONTENT_WIDTH, height).fill(COLORS.mist);

  let x = MARGIN;
  for (const column of TABLE_COLUMNS) {
    const value = values[column.key] ?? '';
    doc.font(header ? 'Helvetica-Bold' : column.key === 'grade' ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(header ? 7 : 8.5)
      .fillColor(header ? COLORS.white : COLORS.text)
      .text(String(value), x + 4, y + (height - (header ? 7 : 8.5)) / 2 + 1, {
        width: column.width - 8,
        align: column.align,
        height: height - 4,
        ellipsis: true,
        lineBreak: false,
      });
    x += column.width;
  }
  if (!header) {
    doc.moveTo(MARGIN, y + height).lineTo(MARGIN + CONTENT_WIDTH, y + height).lineWidth(0.4).strokeColor(COLORS.border).stroke();
  }
}

function drawMarksTable(doc, y, data) {
  const rowHeight = 17;
  const subjects = data.result?.subjects ?? [];
  const showMax = data.exam.maxScore !== 100;

  drawTableRow(doc, y, 18, Object.fromEntries(TABLE_COLUMNS.map((c) => [c.key, c.label])), { header: true });
  let rowY = y + 18;

  if (subjects.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(COLORS.muted)
      .text('No marks recorded for this examination.', MARGIN, rowY + 6, { width: CONTENT_WIDTH, align: 'center' });
    return rowY + 26;
  }

  subjects.forEach((subject, index) => {
    if (rowY + rowHeight > BOTTOM_LIMIT) {
      doc.addPage();
      rowY = MARGIN;
      drawTableRow(doc, rowY, 18, Object.fromEntries(TABLE_COLUMNS.map((c) => [c.key, c.label])), { header: true });
      rowY += 18;
    }
    const marks = subject.isAbsent
      ? 'ABS'
      : showMax ? `${formatNumber(subject.score)} / ${formatNumber(data.exam.maxScore)}` : formatNumber(subject.score);
    drawTableRow(doc, rowY, rowHeight, {
      index: index + 1,
      subject: subject.name,
      marks,
      percentage: subject.isAbsent ? '-' : formatNumber(subject.percentage, 1),
      grade: subject.grade ?? '-',
      points: subject.points === null || subject.points === undefined || data.level === 'primary' || data.level === 'nursery'
        ? '-'
        : formatNumber(subject.points, 1),
      remarks: subject.teacherRemark || subject.remark || '',
      teacher: subject.teacherName || '',
    }, { shaded: index % 2 === 1 });
    rowY += rowHeight;
  });

  doc.rect(MARGIN, y, CONTENT_WIDTH, rowY - y).lineWidth(0.8).strokeColor(COLORS.navy).stroke();
  return rowY + 12;
}

function drawSummary(doc, y, data) {
  const height = 112;
  if (y + height > BOTTOM_LIMIT) {
    doc.addPage();
    y = MARGIN;
  }
  const { result } = data;
  const leftWidth = CONTENT_WIDTH * 0.55;
  const rightX = MARGIN + leftWidth + 10;
  const rightWidth = CONTENT_WIDTH - leftWidth - 10;

  doc.rect(MARGIN, y, leftWidth, height).fillAndStroke(COLORS.mist, COLORS.slate);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.navy)
    .text('OVERALL PERFORMANCE SUMMARY', MARGIN + 10, y + 8, { characterSpacing: 0.6 });

  const overall = result?.overall;
  const rows = [
    ['Total Marks', result ? `${formatNumber(result.totalScore)} / ${formatNumber(result.maxPossible)}` : '-'],
    ['Average Score', result?.averagePct !== null && result?.averagePct !== undefined ? `${formatNumber(result.averagePct)}%` : '-'],
    ['Average Grade', overall?.averageGrade ?? '-'],
    [
      overall?.type === 'division' ? `Division (best ${overall.bestOf})` : 'Overall Grade',
      overall ? `${overall.value}${overall.points !== null && overall.points !== undefined ? `   (${formatNumber(overall.points, 1)} points)` : ''}` : '-',
    ],
    ['Overall Remark', overall?.remark ?? '-'],
    ['Subjects Sat', result ? String(result.subjectsSat) : '-'],
  ];
  let rowY = y + 24;
  for (const [label, value] of rows) {
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(label, MARGIN + 10, rowY, { width: 110, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.text)
      .text(value, MARGIN + 125, rowY - 0.5, { width: leftWidth - 135, lineBreak: false, ellipsis: true });
    rowY += 14;
  }

  doc.rect(rightX, y, rightWidth, height).lineWidth(0.6).strokeColor(COLORS.border).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.navy)
    .text('GRADING KEY', rightX + 8, y + 8, { characterSpacing: 0.6 });
  let keyY = y + 22;
  const keyRowHeight = Math.min(12, (height - 28) / Math.max(1, data.gradingScale.length));
  for (const band of data.gradingScale) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.text).text(band.grade, rightX + 8, keyY, { width: 16, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.text).text(band.range, rightX + 26, keyY, { width: 62, lineBreak: false });
    doc.fillColor(COLORS.muted).text(band.remark, rightX + 90, keyY, { width: rightWidth - 98, lineBreak: false, ellipsis: true });
    keyY += keyRowHeight;
  }
  return y + height + 12;
}

function drawRemarkBlock(doc, y, title, remark, signatory, { signature = null, stamp = null } = {}) {
  const height = 70;
  doc.rect(MARGIN, y, CONTENT_WIDTH, height).lineWidth(0.6).strokeColor(COLORS.border).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.navy).text(title.toUpperCase(), MARGIN + 10, y + 8, { characterSpacing: 0.5 });

  if (remark) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text)
      .text(remark, MARGIN + 10, y + 21, { width: CONTENT_WIDTH - 20, height: 26, ellipsis: true });
  } else {
    for (const lineY of [y + 32, y + 44]) {
      doc.moveTo(MARGIN + 10, lineY).lineTo(MARGIN + CONTENT_WIDTH - 10, lineY).lineWidth(0.4)
        .dash(1.5, { space: 2 }).strokeColor(COLORS.steel).stroke().undash();
    }
  }

  const lineY = y + height - 12;
  // Uploaded signature sits on the line; the official stamp overlaps the right edge like an ink stamp.
  drawImage(doc, signature, MARGIN + 30, lineY - 30, [150, 30]);
  drawImage(doc, stamp, MARGIN + CONTENT_WIDTH - 82, y + 4, [74, 62], { opacity: 0.85 });
  doc.moveTo(MARGIN + 10, lineY).lineTo(MARGIN + 210, lineY).lineWidth(0.5).strokeColor(COLORS.text).stroke();
  doc.moveTo(MARGIN + 330, lineY).lineTo(MARGIN + 460, lineY).stroke();
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted)
    .text(`Signature${signatory ? ` — ${signatory}` : ''}`, MARGIN + 10, lineY + 2, { width: 200, lineBreak: false })
    .text('Date', MARGIN + 330, lineY + 2, { width: 130, lineBreak: false });
  return y + height + 8;
}

function drawFooter(doc) {
  const y = PAGE_HEIGHT - MARGIN - 10;
  doc.moveTo(MARGIN, y - 4).lineTo(MARGIN + CONTENT_WIDTH, y - 4).lineWidth(0.4).strokeColor(COLORS.steel).stroke();
  doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted)
    .text(
      `Issued on ${formatDisplayDate(todayInSchoolTz())}. This report is valid only when signed and bearing the official school stamp.`,
      MARGIN, y, { width: CONTENT_WIDTH, align: 'center', lineBreak: false },
    );
}

/** Render one student's report card onto the current page(s) of `doc`. */
export function renderReportCard(doc, data) {
  const branding = data.branding ?? {};
  let y = drawSchoolHeader(doc, { left: MARGIN, top: MARGIN, width: CONTENT_WIDTH, school: data.school, logo: branding.logo });
  y = drawTitle(doc, y, data.exam);
  y = drawInfoGrid(doc, y, data);
  y = drawMarksTable(doc, y, data);
  y = drawSummary(doc, y, data);
  if (y + 156 > BOTTOM_LIMIT) {
    drawFooter(doc);
    doc.addPage();
    y = MARGIN;
  }
  y = drawRemarkBlock(doc, y, "Class Teacher's Remarks", data.remarks.classTeacherRemark, data.classTeacherName);
  drawRemarkBlock(doc, y, "Headmaster's Remarks", data.remarks.headmasterRemark, data.school.headmasterName || 'Headmaster', {
    signature: branding.headmasterSignature,
    stamp: branding.stamp,
  });
  drawFooter(doc);
}

export const reportFileName = pdfFileName;
