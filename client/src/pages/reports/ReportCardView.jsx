import { Download, Eye, FileText, Printer, Save, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, saveBlob } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import StudentSearch from '../../components/ui/StudentSearch.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { classLabel } from '../../utils/format.js';
import ReportCardPaper from './ReportCardPaper.jsx';
import { useTranslation } from 'react-i18next';

const fileNameFor = (...parts) => `${parts.filter(Boolean).join('-').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}.pdf`;

function RemarksEditor({ card, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState({
    classTeacherRemark: card.remarks.classTeacherRemark ?? '',
    headmasterRemark: card.remarks.headmasterRemark ?? '',
  });
  const [saving, setSaving] = useState(false);
  const { editClassTeacherRemark, editHeadmasterRemark } = card.permissions;
  if (!editClassTeacherRemark && !editHeadmasterRemark) return null;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const body = { examId: card.exam.id, studentId: card.student.id };
      if (editClassTeacherRemark) body.classTeacherRemark = values.classTeacherRemark;
      if (editHeadmasterRemark) body.headmasterRemark = values.headmasterRemark;
      await api.put('/reports/remarks', body);
      toast.success('Remarks saved.');
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={save}>
      <div className="card__header"><h2 className="card__title">Report card remarks</h2></div>
      <div className="card__body stack">
        {editClassTeacherRemark && (
          <FormField label="Class teacher's remarks" hint="Printed on the report card">
            <textarea className="form-control" rows={3} maxLength={500} value={values.classTeacherRemark}
              onChange={(event) => setValues((v) => ({ ...v, classTeacherRemark: event.target.value }))} />
          </FormField>
        )}
        {editHeadmasterRemark && (
          <FormField label="Headmaster's remarks">
            <textarea className="form-control" rows={3} maxLength={500} value={values.headmasterRemark}
              onChange={(event) => setValues((v) => ({ ...v, headmasterRemark: event.target.value }))} />
          </FormField>
        )}
      </div>
      <div className="card__footer form-actions form-actions--flush">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save remarks'}
        </button>
      </div>
    </form>
  );
}

function ClassBatchDownload() {
  const exams = useApi('/exams');
  const classes = useApi('/academics/classes');
  const { run, pending } = useAsyncAction();
  const [selection, setSelection] = useState({ examId: '', classId: '', streamId: '' });
  const available = (exams.data ?? []).filter((exam) => exam.status !== 'draft');
  const cls = (classes.data ?? []).find((item) => String(item.id) === selection.classId);

  const download = () => run('batch', async () => {
    const blob = await api.blob(`/reports/classes/${selection.classId}/report-cards.pdf`, {
      examId: selection.examId,
      streamId: selection.streamId,
    });
    const exam = available.find((item) => String(item.id) === selection.examId);
    saveBlob(blob, fileNameFor('report-cards', cls?.className, selection.streamId ? cls?.streams.find((s) => String(s.id) === selection.streamId)?.streamName : '', exam?.name));
  }, 'Class report cards downloaded.');

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Print a whole class</h2>
        <Users size={16} aria-hidden="true" />
      </div>
      <div className="card__body form-grid form-grid--3">
        <FormField label="Examination">
          <select className="form-control" value={selection.examId} onChange={(event) => setSelection((s) => ({ ...s, examId: event.target.value }))}>
            <option value="">Select…</option>
            {available.map((exam) => <option key={exam.id} value={exam.id}>{exam.name} — {exam.termName} {exam.yearLabel}</option>)}
          </select>
        </FormField>
        <FormField label="Class">
          <select className="form-control" value={selection.classId} onChange={(event) => setSelection((s) => ({ ...s, classId: event.target.value, streamId: '' }))}>
            <option value="">Select…</option>
            {(classes.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.className}</option>)}
          </select>
        </FormField>
        <FormField label="Stream">
          <select className="form-control" value={selection.streamId} onChange={(event) => setSelection((s) => ({ ...s, streamId: event.target.value }))} disabled={!cls?.streams.length}>
            <option value="">All streams</option>
            {(cls?.streams ?? []).map((stream) => <option key={stream.id} value={stream.id}>Stream {stream.streamName}</option>)}
          </select>
        </FormField>
      </div>
      <div className="card__footer form-actions form-actions--flush">
        <button type="button" className="btn btn--secondary" onClick={download} disabled={!selection.examId || !selection.classId || pending === 'batch'}>
          <Download size={16} aria-hidden="true" /> {pending === 'batch' ? 'Generating…' : 'Download all report cards (PDF)'}
        </button>
      </div>
    </section>
  );
}

export default function ReportCardView() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const isParent = hasRole('parent');
  const isStaff = hasRole('admin', 'teacher');
  const [params, setParams] = useSearchParams();
  const studentId = params.get('studentId') || '';
  const { run, pending } = useAsyncAction();
  const [pdf, setPdf] = useState(null);

  const children = useApi(isParent ? '/students' : null, { pageSize: 50, status: '' });
  const student = useApi(studentId ? `/students/${studentId}` : null);
  const available = useApi(studentId ? `/reports/students/${studentId}/available` : null);
  const examId = params.get('examId') || (available.data?.[0] ? String(available.data[0].examId) : '');
  const card = useApi(studentId && examId ? `/reports/students/${studentId}/report-card` : null, { examId });

  const pdfKey = `${studentId}:${examId}`;
  useEffect(() => () => {
    if (pdf) URL.revokeObjectURL(pdf.url);
  }, [pdf]);

  const select = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
    setPdf(null);
  };

  const fetchPdf = async () => {
    const blob = await api.blob(`/reports/students/${studentId}/report-card.pdf`, { examId, disposition: 'inline' });
    return { key: pdfKey, url: URL.createObjectURL(blob), blob };
  };

  const preview = () => run('preview', async () => setPdf(await fetchPdf()));
  const download = () => run('download', async () => {
    const file = pdf?.key === pdfKey ? pdf : await fetchPdf();
    if (file !== pdf) setPdf(file);
    saveBlob(file.blob, fileNameFor('report-card', card.data?.student.registrationNumber, card.data?.exam.name, card.data?.exam.yearLabel));
  });
  const print = () => {
    const printWindow = window.open('', '_blank');
    run('print', async () => {
      const file = pdf?.key === pdfKey ? pdf : await fetchPdf();
      if (file !== pdf) setPdf(file);
      if (printWindow) printWindow.location.href = file.url;
    }).then(({ ok }) => {
      if (!ok) printWindow?.close();
    });
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={t('pages.marks.eyebrow')}
        title={t('pages.reports.title')}
        subtitle={isParent ? t('pages.reports.subtitleParent') : t('pages.reports.subtitleStaff')}
      />

      <div className="filter-bar card">
        {isParent ? (
          <label className="filter-bar__field filter-bar__field--wide">
            <span className="eyebrow">Child</span>
            <select className="form-control" value={studentId} onChange={(event) => select({ studentId: event.target.value, examId: '' })}>
              <option value="">Select your child…</option>
              {(children.data?.items ?? []).map((child) => (
                <option key={child.id} value={child.id}>{child.fullName} — {child.registrationNumber}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="filter-bar__field filter-bar__field--wide">
            <span className="eyebrow">Student</span>
            <StudentSearch onSelect={(found) => select({ studentId: String(found.id), examId: '' })} />
          </div>
        )}
        {studentId && (
          <label className="filter-bar__field">
            <span className="eyebrow">Examination</span>
            <select className="form-control" value={examId} onChange={(event) => select({ examId: event.target.value })} disabled={!available.data?.length}>
              {available.data?.length === 0 && <option value="">No reports available</option>}
              {(available.data ?? []).map((exam) => (
                <option key={exam.examId} value={exam.examId}>{exam.name} — {exam.termName} {exam.yearLabel}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {student.data && (
        <div className="selected-student">
          <FileText size={18} aria-hidden="true" />
          <strong>{student.data.student.fullName}</strong>
          <span className="reg-no">{student.data.student.registrationNumber}</span>
          <span className="text-muted">{classLabel(student.data.student.className, student.data.student.streamName)}</span>
          <StatusBadge status={student.data.student.status} />
        </div>
      )}
      <ErrorBlock error={student.error || available.error} />

      {!studentId && (
        <EmptyState icon={FileText} title="Select a student" message={isParent ? 'Choose one of your children to view their report cards.' : 'Search for a student to preview their report card.'} />
      )}
      {studentId && available.data?.length === 0 && (
        <EmptyState icon={FileText} title="No report cards yet" message={isParent ? 'Report cards appear once the school publishes examination results.' : 'No marks have been recorded for this student in an open, closed or published exam.'} />
      )}

      {card.loading && !card.data && <LoadingBlock label="Preparing report card…" />}
      <ErrorBlock error={card.error} onRetry={card.reload} />

      {card.data && (
        <div className="report-layout">
          <div className="stack">
            <div className="report-actions">
              <button type="button" className="btn btn--primary" onClick={download} disabled={pending === 'download'}>
                <Download size={16} aria-hidden="true" /> {pending === 'download' ? 'Preparing…' : 'Download PDF'}
              </button>
              <button type="button" className="btn btn--outline" onClick={print} disabled={pending === 'print'}>
                <Printer size={16} aria-hidden="true" /> Print
              </button>
              <button type="button" className="btn btn--outline" onClick={preview} disabled={pending === 'preview'}>
                <Eye size={16} aria-hidden="true" /> {pdf?.key === pdfKey ? 'Refresh PDF preview' : 'Preview PDF'}
              </button>
            </div>
            {pdf?.key === pdfKey ? (
              <iframe title="Report card PDF preview" className="pdf-frame" src={pdf.url} />
            ) : (
              <ReportCardPaper card={card.data} />
            )}
          </div>
          {isStaff && (
            <aside className="stack">
              <RemarksEditor
                key={`${card.data.exam.id}-${card.data.student.id}`}
                card={card.data}
                onSaved={() => {
                  setPdf(null);
                  card.reload();
                }}
              />
            </aside>
          )}
        </div>
      )}

      {isStaff && <ClassBatchDownload />}
    </div>
  );
}
