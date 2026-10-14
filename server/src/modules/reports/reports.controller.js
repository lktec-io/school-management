import { asyncHandler } from '../../middleware/errorHandler.js';
import { auditContext } from '../../utils/audit.js';
import { streamPdf } from '../../utils/pdfResponse.js';
import { optionalId, parseId, validator } from '../../utils/validator.js';
import { loadBranding } from '../system/branding.service.js';
import { createReportDocument, renderReportCard, reportFileName } from './reportCard.pdf.js';
import * as reportsService from './reports.service.js';

function sendPdf(res, req, fileName, title, schoolName, render) {
  streamPdf(req, res, createReportDocument(title, schoolName), fileName, render);
}

export const listAvailable = asyncHandler(async (req, res) => {
  const reports = await reportsService.listAvailableReports(parseId(req.params.studentId, 'studentId'), req.user);
  res.json({ success: true, data: reports });
});

export const getReportCardData = asyncHandler(async (req, res) => {
  const data = await reportsService.getReportCardData(
    parseId(req.params.studentId, 'studentId'),
    parseId(req.query.examId, 'examId'),
    req.user,
  );
  res.json({ success: true, data });
});

export const downloadReportCard = asyncHandler(async (req, res) => {
  // Data is fully assembled before streaming starts so errors still return a JSON response.
  const data = await reportsService.getReportCardData(
    parseId(req.params.studentId, 'studentId'),
    parseId(req.query.examId, 'examId'),
    req.user,
  );
  const branding = await loadBranding();
  const fileName = reportFileName('report-card', data.student.registrationNumber, data.exam.name, data.exam.yearLabel);
  sendPdf(res, req, fileName, `Report Card — ${data.student.fullName}`, data.school.name, (doc) => renderReportCard(doc, { ...data, branding }));
});

export const downloadClassReportCards = asyncHandler(async (req, res) => {
  const { exam, className, cards } = await reportsService.getClassReportCards(
    parseId(req.query.examId, 'examId'),
    parseId(req.params.classId, 'classId'),
    optionalId(req.query.streamId, 'streamId'),
    req.user,
  );
  const branding = await loadBranding();
  const fileName = reportFileName('report-cards', className, exam.name, exam.yearLabel);
  sendPdf(res, req, fileName, `Report Cards — ${className} — ${exam.name}`, cards[0].school.name, (doc) => {
    cards.forEach((card, index) => {
      if (index > 0) doc.addPage();
      renderReportCard(doc, { ...card, branding });
    });
  });
});

export const saveRemarks = asyncHandler(async (req, res) => {
  const data = validator(req.body)
    .id('examId', { required: true })
    .id('studentId', { required: true })
    .string('classTeacherRemark', { max: 500, multiline: true })
    .string('headmasterRemark', { max: 500, multiline: true })
    .rule('classTeacherRemark', (values, input) => (
      input.classTeacherRemark === undefined && input.headmasterRemark === undefined ? 'Provide at least one remark' : null
    ))
    .result();
  const remarks = await reportsService.saveRemarks(data, req.user, auditContext(req));
  res.json({ success: true, data: remarks, message: 'Remarks saved' });
});
