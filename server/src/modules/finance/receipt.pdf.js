import PDFDocument from 'pdfkit';
import { SCHOOL_TIMEZONE, formatDisplayDate } from '../../utils/dates.js';
import { amountInWords } from '../../utils/numberWords.js';
import { PDF_COLORS as COLORS, drawImage, drawSchoolHeader } from '../../utils/pdfBranding.js';

const PAGE = { width: 419.53, height: 595.28 }; // A5 portrait
const MARGIN = 28;
const WIDTH = PAGE.width - MARGIN * 2;

const MODE_LABELS = {
  cash: 'Cash',
  bank_deposit: 'Bank Deposit',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  cheque: 'Cheque',
};

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatAmount = (value) => money.format(Number(value));
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHOOL_TIMEZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

export function createReceiptDocument(title, schoolName) {
  return new PDFDocument({
    size: 'A5',
    margin: MARGIN,
    info: { Title: title, Author: schoolName, Creator: `${schoolName} School Management System` },
  });
}

function labelValue(doc, x, y, width, label, value, { mono = false, bold = false } = {}) {
  doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted).text(label.toUpperCase(), x, y, { width, characterSpacing: 0.4, lineBreak: false });
  doc.font(mono ? 'Courier-Bold' : bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(mono ? 9.5 : 9).fillColor(COLORS.text)
    .text(String(value ?? '-'), x, y + 9, { width, height: 12, ellipsis: true, lineBreak: false });
}

function drawWatermark(doc) {
  doc.save();
  doc.rotate(-30, { origin: [PAGE.width / 2, PAGE.height / 2] });
  doc.font('Helvetica-Bold').fontSize(64).fillColor(COLORS.danger).fillOpacity(0.12)
    .text('REVERSED', 0, PAGE.height / 2 - 40, { width: PAGE.width, align: 'center' });
  doc.restore();
  doc.fillOpacity(1);
}

/** Render one A5 payment receipt. */
export function renderReceipt(doc, { payment, balance, printedBy, school, branding = {} }) {
  const reversed = payment.status === 'reversed';
  if (reversed) drawWatermark(doc);

  let y = drawSchoolHeader(doc, { left: MARGIN, top: MARGIN, width: WIDTH, compact: true, school, logo: branding.logo });

  // Title band with receipt number
  doc.rect(MARGIN, y, WIDTH, 26).fill(COLORS.navy);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.white)
    .text(reversed ? 'OFFICIAL RECEIPT — REVERSED' : 'OFFICIAL RECEIPT', MARGIN + 10, y + 8, { characterSpacing: 0.8, lineBreak: false });
  doc.font('Courier-Bold').fontSize(11).fillColor(COLORS.white)
    .text(payment.receiptNo, MARGIN, y + 8, { width: WIDTH - 10, align: 'right', lineBreak: false });
  y += 36;

  // Particulars
  const col = WIDTH / 2;
  labelValue(doc, MARGIN, y, col - 8, 'Payment date', formatDisplayDate(payment.paymentDate));
  labelValue(doc, MARGIN + col, y, col, 'Recorded (EAT)', dateTimeFormatter.format(new Date(payment.createdAt)), { mono: true });
  y += 26;
  labelValue(doc, MARGIN, y, col - 8, 'Received from', payment.parentName, { bold: true });
  labelValue(doc, MARGIN + col, y, col, 'Term', `${payment.termName} ${payment.yearLabel}`);
  y += 26;
  labelValue(doc, MARGIN, y, col - 8, 'Student name', payment.fullName.toUpperCase(), { bold: true });
  labelValue(doc, MARGIN + col, y, col, 'Registration no.', payment.registrationNumber, { mono: true });
  y += 26;
  labelValue(doc, MARGIN, y, col - 8, 'Class / stream', payment.streamName ? `${payment.className} ${payment.streamName}` : payment.className);
  labelValue(doc, MARGIN + col, y, col, 'Received by', payment.recordedByName);
  y += 30;

  // Itemised table
  const columns = [
    { label: 'DESCRIPTION', width: WIDTH * 0.34 },
    { label: 'METHOD', width: WIDTH * 0.2 },
    { label: 'REFERENCE', width: WIDTH * 0.22 },
    { label: 'AMOUNT (TZS)', width: WIDTH * 0.24, align: 'right' },
  ];
  doc.rect(MARGIN, y, WIDTH, 16).fill(COLORS.slate);
  let x = MARGIN;
  for (const column of columns) {
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.white)
      .text(column.label, x + 5, y + 5, { width: column.width - 10, align: column.align || 'left', lineBreak: false });
    x += column.width;
  }
  y += 16;
  const rowValues = [
    payment.feeTypeName || 'School fees (general)',
    MODE_LABELS[payment.paymentMode] || payment.paymentMode,
    payment.referenceNo || '—',
    formatAmount(payment.amountPaid),
  ];
  x = MARGIN;
  columns.forEach((column, index) => {
    doc.font(index >= 2 ? 'Courier' : 'Helvetica').fontSize(index >= 2 ? 8.5 : 8.5).fillColor(COLORS.text)
      .text(rowValues[index], x + 5, y + 6, { width: column.width - 10, align: column.align || 'left', height: 12, ellipsis: true, lineBreak: false });
    x += column.width;
  });
  y += 22;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + WIDTH, y).lineWidth(0.5).strokeColor(COLORS.border).stroke();

  doc.rect(MARGIN + WIDTH * 0.52, y + 4, WIDTH * 0.48, 20).fill(COLORS.mist);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.navy)
    .text('TOTAL PAID', MARGIN + WIDTH * 0.52 + 6, y + 10, { lineBreak: false });
  doc.font('Courier-Bold').fontSize(10.5).fillColor(COLORS.navy)
    .text(`TZS ${formatAmount(payment.amountPaid)}`, MARGIN, y + 9, { width: WIDTH - 6, align: 'right', lineBreak: false });
  y += 30;

  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COLORS.muted)
    .text(`Amount in words: ${amountInWords(payment.amountPaid)}`, MARGIN, y, { width: WIDTH });
  y = doc.y + 10;

  // Term account summary
  doc.rect(MARGIN, y, WIDTH, 52).lineWidth(0.8).strokeColor(COLORS.slate).stroke();
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.navy)
    .text(`ACCOUNT SUMMARY — ${payment.termName.toUpperCase()} ${payment.yearLabel}`, MARGIN + 8, y + 6, { characterSpacing: 0.5, lineBreak: false });
  const third = (WIDTH - 16) / 3;
  const outstanding = balance.balance;
  const summary = [
    ['Term bill (after discounts)', formatAmount(balance.expected), COLORS.text],
    ['Total paid to date', formatAmount(balance.paid), COLORS.success],
    [outstanding < 0 ? 'Credit balance' : 'Outstanding balance', formatAmount(Math.abs(outstanding)), outstanding > 0 ? COLORS.danger : COLORS.success],
  ];
  summary.forEach(([label, value, color], index) => {
    const sx = MARGIN + 8 + third * index;
    doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted).text(label.toUpperCase(), sx, y + 20, { width: third - 6, lineBreak: false });
    doc.font('Courier-Bold').fontSize(10).fillColor(color).text(`TZS ${value}`, sx, y + 32, { width: third - 6, lineBreak: false });
  });
  y += 62;

  if (reversed) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.danger)
      .text(`Reversed on ${dateTimeFormatter.format(new Date(payment.reversedAt))} by ${payment.reversedByName}. Reason: ${payment.reversalReason}`,
        MARGIN, y, { width: WIDTH });
    y = doc.y + 8;
  }

  // Signature & stamp
  const signatureY = Math.max(y + 34, PAGE.height - MARGIN - 92);
  // Uploaded signature is printed on the line; reversed receipts are never shown as signed.
  if (!reversed) drawImage(doc, branding.bursarSignature, MARGIN + 10, signatureY - 30, [130, 28]);
  doc.moveTo(MARGIN, signatureY).lineTo(MARGIN + 150, signatureY).lineWidth(0.5).strokeColor(COLORS.text).stroke();
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted)
    .text(`Bursar's signature — ${school.bursarName || payment.recordedByName}`, MARGIN, signatureY + 3, { width: 170, lineBreak: false });
  const stampX = MARGIN + WIDTH - 44;
  if (reversed || !drawImage(doc, branding.stamp, stampX - 36, signatureY - 50, [72, 72], { opacity: 0.85 })) {
    doc.save();
    doc.circle(stampX, signatureY - 14, 34).lineWidth(0.8).dash(2, { space: 2 }).strokeColor(COLORS.steel).stroke().undash();
    doc.restore();
    doc.font('Helvetica').fontSize(6).fillColor(COLORS.steel)
      .text('OFFICIAL STAMP', stampX - 30, signatureY - 17, { width: 60, align: 'center', lineBreak: false });
  }

  // Footer
  const footerY = PAGE.height - MARGIN - 26;
  doc.moveTo(MARGIN, footerY).lineTo(MARGIN + WIDTH, footerY).lineWidth(0.4).strokeColor(COLORS.steel).stroke();
  doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted)
    .text(`Printed by ${printedBy} on ${dateTimeFormatter.format(new Date())} EAT.`, MARGIN, footerY + 5, { width: WIDTH, align: 'center', lineBreak: false })
    .text('Computer-generated receipt. Valid only with the bursar\'s signature and the official school stamp.', MARGIN, footerY + 14, {
      width: WIDTH, align: 'center', lineBreak: false,
    });
}
