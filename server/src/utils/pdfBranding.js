import logger from './logger.js';

export const PDF_COLORS = {
  navy: '#0B2545',
  slate: '#134074',
  steel: '#8DA9C4',
  steelLight: '#C9D8E6',
  mist: '#EEF4F8',
  text: '#1B1F24',
  muted: '#5C6670',
  border: '#B8C7D6',
  white: '#FFFFFF',
  danger: '#B42318',
  success: '#1E7A46',
};

/** Draw an uploaded image (signature/stamp) fitted into a box; returns false if it cannot be embedded. */
export function drawImage(doc, buffer, x, y, fit, { opacity = 1 } = {}) {
  if (!buffer) return false;
  try {
    doc.save();
    if (opacity < 1) doc.opacity(opacity);
    doc.image(buffer, x, y, { fit, align: 'center', valign: 'center' });
    doc.restore();
    return true;
  } catch (error) {
    doc.restore();
    logger.warn('Branding image could not be embedded in PDF', { error: error.message });
    return false;
  }
}

function drawSeal(doc, cx, cy, radius, schoolName) {
  const initials = schoolName
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word) && !['of', 'the', 'and', 'school'].includes(word.toLowerCase()))
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join('') || 'S';
  const scale = radius / 30;
  doc.save();
  doc.circle(cx, cy, radius).lineWidth(2 * scale).strokeColor(PDF_COLORS.navy).stroke();
  doc.circle(cx, cy, radius - 5 * scale).lineWidth(0.6).strokeColor(PDF_COLORS.steel).stroke();
  doc.font('Helvetica-Bold').fontSize(14 * scale).fillColor(PDF_COLORS.navy)
    .text(initials, cx - radius, cy - 10 * scale, { width: radius * 2, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(5.5 * scale).fillColor(PDF_COLORS.slate)
    .text('ZANZIBAR', cx - radius, cy + 7 * scale, { width: radius * 2, align: 'center', characterSpacing: scale, lineBreak: false });
  doc.restore();
}

/**
 * Official letterhead: crest/logo on the left, centred school identity, double rule beneath.
 * `school` is the profile from system settings; `logo` an optional PNG/JPEG Buffer.
 * Returns the y coordinate below the rule.
 */
export function drawSchoolHeader(doc, { left, top, width, compact = false, school, logo = null }) {
  const crestSize = compact ? 48 : 64;
  const drewLogo = drawImage(doc, logo, left, top, [crestSize, crestSize]);
  if (!drewLogo) drawSeal(doc, left + crestSize / 2, top + crestSize / 2, crestSize / 2 - 2, school.name);

  const textX = left + crestSize + 10;
  const textWidth = width - (crestSize + 10) * 2;
  doc.font('Helvetica-Bold').fontSize(compact ? 12 : 15).fillColor(PDF_COLORS.navy)
    .text(school.name.toUpperCase(), textX, top + 2, { width: textWidth, align: 'center' });

  const contact = [school.phone && `Tel: ${school.phone}`, school.email && `Email: ${school.email}`].filter(Boolean).join('   |   ');
  doc.font('Helvetica').fontSize(compact ? 7.5 : 8.5).fillColor(PDF_COLORS.muted);
  for (const line of [school.address, contact, school.registrationNo && `Registration No: ${school.registrationNo}`]) {
    if (line) doc.text(line, textX, doc.y + 1, { width: textWidth, align: 'center' });
  }
  if (school.motto) {
    doc.font('Helvetica-Oblique').fontSize(compact ? 7.5 : 8.5).fillColor(PDF_COLORS.slate)
      .text(`"${school.motto}"`, textX, doc.y + 2, { width: textWidth, align: 'center' });
  }

  const ruleY = Math.max(doc.y, top + crestSize) + (compact ? 6 : 8);
  doc.moveTo(left, ruleY).lineTo(left + width, ruleY).lineWidth(compact ? 1.5 : 2).strokeColor(PDF_COLORS.navy).stroke();
  doc.moveTo(left, ruleY + 3).lineTo(left + width, ruleY + 3).lineWidth(0.5).stroke();
  return ruleY + (compact ? 10 : 12);
}

/** Safe download filename from arbitrary parts. */
export function pdfFileName(...parts) {
  const slug = parts
    .filter(Boolean)
    .join('-')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${slug || 'document'}.pdf`;
}
