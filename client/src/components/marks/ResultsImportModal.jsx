import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, MessageSquare, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, saveBlob } from '../../api/client.js';
import { useSchoolProfile } from '../../hooks/useSchoolProfile.js';
import { InlineAlert } from '../ui/Feedback.jsx';
import Modal from '../ui/Modal.jsx';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ACCEPTED = /\.(csv|xlsx|txt)$/i;

/** multipart/form-data body for POST /results/import (the server parses and validates the file). */
function importForm(file, fields) {
  const form = new FormData();
  form.append('file', file);
  for (const [name, value] of Object.entries(fields)) form.append(name, String(value));
  return form;
}

function FailedRows({ rows, title }) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <section className="stack">
      <h3 className="import-step__title">{title}</h3>
      <ul className="import-failed">
        {rows.map((row) => (
          <li key={row.line}>
            <strong>{t('resultsImport.row', { line: row.line })}{row.registrationNumber ? ` · ${row.registrationNumber}` : ''}{row.name ? ` · ${row.name}` : ''}</strong>
            <ul>{(row.reasons ?? [row.message]).map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "Pakia Matokeo" — upload a whole mark sheet: download template → upload → review every row → save,
 * optionally texting parents (Headmaster only). The final screen accounts for every row of the file.
 */
export default function ResultsImportModal({ exams, classes, canSendSms, onClose, onImported }) {
  const { t } = useTranslation();
  const school = useSchoolProfile();
  const inputRef = useRef(null);
  const openExams = exams.filter((exam) => exam.status === 'open');
  const [examId, setExamId] = useState(openExams[0] ? String(openExams[0].id) : '');
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [stage, setStage] = useState('upload');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sendSms, setSendSms] = useState(false);
  const [result, setResult] = useState(null);

  const streams = classes.find((cls) => String(cls.id) === classId)?.streams ?? [];

  const downloadTemplate = async () => {
    setError(null);
    setBusy('template');
    try {
      const params = { examId, classId, streamId };
      const slug = String(school?.name ?? 'school').split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'school';
      saveBlob(await api.blob('/results/import/template', Object.fromEntries(Object.entries(params).filter(([, value]) => value))), `${slug}_results_template.csv`);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(null);
    }
  };

  const handleFile = async (chosen) => {
    if (!chosen) return;
    setError(null);
    if (!ACCEPTED.test(chosen.name)) {
      setError(t('resultsImport.errors.unsupported'));
      return;
    }
    if (chosen.size > MAX_FILE_BYTES) {
      setError(t('resultsImport.errors.tooLarge'));
      return;
    }
    setFile(chosen);
    setBusy('checking');
    try {
      setPreview(await api.upload('/results/import', importForm(chosen, { dryRun: true, ...(examId ? { examId } : {}) })));
      setStage('preview');
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const commit = async () => {
    setError(null);
    setBusy('saving');
    try {
      setResult(await api.upload('/results/import', importForm(file, { sendSms, ...(examId ? { examId } : {}) })));
      setStage('done');
      onImported?.();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(null);
    }
  };

  const restart = () => {
    setStage('upload');
    setPreview(null);
    setFile(null);
    setSendSms(false);
    setError(null);
  };

  const footer = stage === 'upload' ? (
    <button type="button" className="btn btn--outline" onClick={onClose} disabled={Boolean(busy)}>{t('common.cancel')}</button>
  ) : stage === 'preview' ? (
    <>
      <button type="button" className="btn btn--outline" onClick={restart} disabled={Boolean(busy)}>
        <RotateCcw size={15} aria-hidden="true" /> {t('resultsImport.chooseAnother')}
      </button>
      <button type="button" className="btn btn--primary" onClick={commit} disabled={Boolean(busy) || preview.toWrite === 0}>
        <Upload size={15} aria-hidden="true" /> {busy === 'saving' ? t('common.saving') : t('resultsImport.saveButton', { count: preview.toWrite })}
      </button>
    </>
  ) : (
    <button type="button" className="btn btn--primary" onClick={onClose}>{t('common.close')}</button>
  );

  return (
    <Modal title={t('resultsImport.title')} size="lg" onClose={onClose} closeDisabled={busy === 'saving'} footer={footer}>
      <div className="stack import-modal">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}

        {stage === 'upload' && (
          <>
            <section className="import-step">
              <span className="import-step__number mono" aria-hidden="true">1</span>
              <div className="import-step__body">
                <h3 className="import-step__title">{t('resultsImport.step1')}</h3>
                <p className="text-sm text-muted">{t('resultsImport.templateHint')}</p>
                <div className="import-template-fields">
                  <label className="filter-bar__field">
                    <span className="eyebrow">{t('resultsImport.exam')}</span>
                    <select className="form-control" value={examId} onChange={(event) => setExamId(event.target.value)}>
                      <option value="">{t('resultsImport.anyExam')}</option>
                      {openExams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name} — {exam.termName} {exam.yearLabel}</option>)}
                    </select>
                  </label>
                  <label className="filter-bar__field">
                    <span className="eyebrow">{t('common.class')}</span>
                    <select className="form-control" value={classId} onChange={(event) => { setClassId(event.target.value); setStreamId(''); }}>
                      <option value="">{t('resultsImport.allClasses')}</option>
                      {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.className}</option>)}
                    </select>
                  </label>
                  <label className="filter-bar__field">
                    <span className="eyebrow">{t('common.stream')}</span>
                    <select className="form-control" value={streamId} onChange={(event) => setStreamId(event.target.value)} disabled={!streams.length}>
                      <option value="">{t('resultsImport.allStreams')}</option>
                      {streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.streamName}</option>)}
                    </select>
                  </label>
                </div>
                <button type="button" className="btn btn--outline" onClick={downloadTemplate} disabled={busy === 'template'}>
                  <Download size={15} aria-hidden="true" /> {t('resultsImport.template')}
                </button>
                <ul className="import-formats">
                  {['marks', 'absent', 'blank', 'open'].map((key) => <li key={key}>{t(`resultsImport.formats.${key}`)}</li>)}
                </ul>
              </div>
            </section>
            <section className="import-step">
              <span className="import-step__number mono" aria-hidden="true">2</span>
              <div className="import-step__body">
                <h3 className="import-step__title">{t('resultsImport.step2')}</h3>
                <label
                  className={`dropzone${dragging ? ' is-dragging' : ''}${busy ? ' is-busy' : ''}`}
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    if (!busy) handleFile(event.dataTransfer.files?.[0]);
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    className="sr-only"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={Boolean(busy)}
                    onChange={(event) => handleFile(event.target.files?.[0])}
                  />
                  <FileSpreadsheet size={30} aria-hidden="true" />
                  <strong>{busy === 'checking' ? t('resultsImport.checking') : t('resultsImport.drop')}</strong>
                  <span className="text-xs text-muted">{file && busy ? file.name : t('resultsImport.dropHint')}</span>
                </label>
              </div>
            </section>
          </>
        )}

        {stage === 'preview' && preview && (
          <>
            <div className="import-summary">
              <span className="import-summary__file"><FileSpreadsheet size={15} aria-hidden="true" /> {file?.name}</span>
              <span className="import-chip import-chip--ok"><CheckCircle2 size={14} aria-hidden="true" /> {t('resultsImport.validCount', { count: preview.valid })}</span>
              {preview.failedCount > 0 && (
                <span className="import-chip import-chip--bad"><AlertTriangle size={14} aria-hidden="true" /> {t('resultsImport.failedCount', { count: preview.failedCount })}</span>
              )}
            </div>
            {preview.overwrites > 0 && <InlineAlert tone="warning">{t('resultsImport.overwriteNote', { count: preview.overwrites })}</InlineAlert>}
            {preview.valid === 0 && <InlineAlert tone="danger">{t('resultsImport.noneValid')}</InlineAlert>}

            <FailedRows rows={preview.failed} title={t('resultsImport.failedTitle')} />
            <FailedRows rows={preview.skipped} title={t('resultsImport.skippedTitle')} />

            {preview.rows.length > 0 && (
              <div className="table-wrapper import-table">
                <table className="data-table data-table--cards">
                  <thead>
                    <tr>
                      <th className="numeric">{t('resultsImport.line')}</th>
                      <th>{t('students.fields.regNo')}</th>
                      <th>{t('students.profile.fullName')}</th>
                      <th>{t('resultsImport.exam')}</th>
                      <th className="numeric">{t('students.profile.subjects')}</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.line}>
                        <td data-label={t('resultsImport.line')} className="numeric mono">{row.line}</td>
                        <td data-label={t('students.fields.regNo')}><span className="reg-no">{row.registrationNumber}</span></td>
                        <td data-label={t('students.profile.fullName')}>
                          <span className="data-table__primary">{row.name}</span>
                          <span className="data-table__secondary">{row.className}</span>
                        </td>
                        <td data-label={t('resultsImport.exam')}>{row.exam}</td>
                        <td data-label={t('students.profile.subjects')} className="numeric mono">{row.subjects}</td>
                        <td data-label={t('common.status')}>
                          <span className={`import-chip ${row.status === 'unchanged' ? 'import-chip--muted' : 'import-chip--ok'}`}>{t(`resultsImport.status.${row.status}`)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canSendSms && preview.toWrite > 0 && (
              <div className="import-sms">
                <label className="import-sms__toggle">
                  <input type="checkbox" checked={sendSms} onChange={(event) => setSendSms(event.target.checked)} />
                  <span><MessageSquare size={15} aria-hidden="true" className="inline-icon" /> {t('resultsImport.smsLabel', { count: preview.toWrite })}</span>
                </label>
                {sendSms && <InlineAlert tone="warning">{t('resultsImport.smsWarning')}</InlineAlert>}
              </div>
            )}
          </>
        )}

        {stage === 'done' && result && (
          <div className="stack">
            <dl className="import-report">
              <div><dt>{t('resultsImport.report.total')}</dt><dd className="mono">{result.total}</dd></div>
              <div className="import-report--ok"><dt>{t('resultsImport.report.saved')}</dt><dd className="mono">{result.saved}</dd></div>
              <div className={result.failedCount ? 'import-report--bad' : undefined}><dt>{t('resultsImport.report.failed')}</dt><dd className="mono">{result.failedCount}</dd></div>
            </dl>
            <InlineAlert tone={result.failedCount ? 'warning' : 'success'}>
              {t('resultsImport.report.marks', result.marks)}
              {result.unchanged > 0 && <> {t('resultsImport.report.unchanged', { count: result.unchanged })}</>}
            </InlineAlert>
            {result.sms.requested && (
              <InlineAlert tone={result.sms.error || result.sms.configured === false ? 'danger' : 'success'} title={t('resultsImport.report.smsTitle')}>
                {result.sms.error
                  ? t('resultsImport.report.smsError', { message: result.sms.error })
                  : result.sms.configured === false
                    ? t('resultsImport.report.smsNotConfigured')
                    : t('resultsImport.report.smsSent', { count: result.sms.recipients })}
                {result.sms.invalidPhones > 0 && <> {t('resultsImport.report.smsInvalid', { count: result.sms.invalidPhones })}</>}
                {result.sms.noResult > 0 && <> {t('resultsImport.report.smsNoResult', { count: result.sms.noResult })}</>}
              </InlineAlert>
            )}
            <FailedRows rows={result.failed} title={t('resultsImport.failedTitle')} />
            <FailedRows rows={result.skipped} title={t('resultsImport.skippedTitle')} />
          </div>
        )}
      </div>
    </Modal>
  );
}
