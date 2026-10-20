import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, saveBlob } from '../../api/client.js';
import { useSchoolProfile } from '../../hooks/useSchoolProfile.js';
import { formatDate, formatPhone } from '../../utils/format.js';
import { InlineAlert } from '../ui/Feedback.jsx';
import Modal from '../ui/Modal.jsx';

/** Server field keys → form labels, so row problems read like the registration form. */
const FIELD_LABELS = {
  firstName: 'students.fields.firstName',
  middleName: 'students.fields.middleName',
  lastName: 'students.fields.lastName',
  gender: 'students.fields.gender',
  dob: 'students.fields.dob',
  className: 'common.class',
  streamName: 'common.stream',
  parentName: 'students.fields.guardianName',
  parentPhone: 'students.fields.guardianPhone',
  parentRelationship: 'students.fields.relationship',
  address: 'students.fields.address',
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ACCEPTED = /.(csv|xlsx|txt)$/i;

/** multipart/form-data body for POST /students/import (the server parses the file). */
function importForm(file, commit) {
  const form = new FormData();
  form.append('file', file);
  if (commit) form.append('commit', 'true');
  return form;
}

function templateFileName(schoolName) {
  const slug = String(schoolName ?? 'school').split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'school';
  return `${slug}_student_import_template.csv`;
}

/**
 * "Ingiza kwa Mkupuo" — register many students from a CSV/Excel file:
 * download template → upload → review every row (problems highlighted) → save the valid rows.
 */
export default function ImportStudentsModal({ onClose, onImported }) {
  const { t } = useTranslation();
  const school = useSchoolProfile();
  const inputRef = useRef(null);
  const [stage, setStage] = useState('upload');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [filter, setFilter] = useState('all');
  const [result, setResult] = useState(null);

  const downloadTemplate = async () => {
    setError(null);
    setBusy('template');
    try {
      saveBlob(await api.blob('/students/import/template'), templateFileName(school?.name));
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
      setError(t('students.import.errors.unsupported'));
      return;
    }
    if (chosen.size > MAX_FILE_BYTES) {
      setError(t('students.import.errors.too-large', { size: MAX_FILE_BYTES / 1024 / 1024 }));
      return;
    }
    setFile(chosen);
    setBusy('checking');
    try {
      const checked = await api.upload('/students/import', importForm(chosen, false));
      setPreview(checked);
      setFilter(checked.summary.invalid > 0 ? 'problems' : 'all');
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
      const saved = await api.upload('/students/import', importForm(file, true));
      setResult(saved);
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
    setError(null);
  };

  const validCount = preview?.summary.valid ?? 0;
  const rows = (preview?.rows ?? []).filter((row) => filter === 'all' || !row.valid);

  const footer = stage === 'upload' ? (
    <button type="button" className="btn btn--outline" onClick={onClose} disabled={Boolean(busy)}>{t('common.cancel')}</button>
  ) : stage === 'preview' ? (
    <>
      <button type="button" className="btn btn--outline" onClick={restart} disabled={Boolean(busy)}>
        <RotateCcw size={15} aria-hidden="true" /> {t('students.import.chooseAnother')}
      </button>
      <button type="button" className="btn btn--primary" onClick={commit} disabled={Boolean(busy) || validCount === 0}>
        <Upload size={15} aria-hidden="true" /> {busy === 'saving' ? t('common.saving') : t('students.import.importButton', { count: validCount })}
      </button>
    </>
  ) : (
    <button type="button" className="btn btn--primary" onClick={onClose}>{t('common.close')}</button>
  );

  return (
    <Modal title={t('students.import.title')} size="lg" onClose={onClose} closeDisabled={busy === 'saving'} footer={footer}>
      <div className="stack import-modal">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}

        {stage === 'upload' && (
          <>
            <section className="import-step">
              <span className="import-step__number mono" aria-hidden="true">1</span>
              <div className="import-step__body">
                <h3 className="import-step__title">{t('students.import.step1')}</h3>
                <p className="text-sm text-muted">{t('students.import.templateHint')}</p>
                <button type="button" className="btn btn--outline" onClick={downloadTemplate} disabled={busy === 'template'}>
                  <Download size={15} aria-hidden="true" /> {t('students.import.template')}
                </button>
                <ul className="import-formats">
                  {['gender', 'date', 'phone', 'class'].map((key) => <li key={key}>{t(`students.import.formats.${key}`)}</li>)}
                </ul>
              </div>
            </section>
            <section className="import-step">
              <span className="import-step__number mono" aria-hidden="true">2</span>
              <div className="import-step__body">
                <h3 className="import-step__title">{t('students.import.step2')}</h3>
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
                  <strong>{busy === 'checking' ? t('students.import.checking') : t('students.import.drop')}</strong>
                  <span className="text-xs text-muted">{file && busy ? file.name : t('students.import.dropHint')}</span>
                </label>
              </div>
            </section>
          </>
        )}

        {stage === 'preview' && preview && (
          <>
            <div className="import-summary">
              <span className="import-summary__file"><FileSpreadsheet size={15} aria-hidden="true" /> {file?.name}</span>
              <span className="import-chip import-chip--ok"><CheckCircle2 size={14} aria-hidden="true" /> {t('students.import.validCount', { count: preview.summary.valid })}</span>
              {preview.summary.invalid > 0 && (
                <span className="import-chip import-chip--bad"><AlertTriangle size={14} aria-hidden="true" /> {t('students.import.invalidCount', { count: preview.summary.invalid })}</span>
              )}
            </div>
            {preview.summary.invalid > 0 && validCount > 0 && <InlineAlert tone="warning">{t('students.import.skipNote', { count: preview.summary.invalid })}</InlineAlert>}
            {validCount === 0 && <InlineAlert tone="danger">{t('students.import.noneValid')}</InlineAlert>}
            {validCount > 0 && <p className="text-sm text-muted">{t('students.import.prefixNote', { prefix: preview.nextPrefix })}</p>}

            <div className="segmented" role="group" aria-label={t('students.import.filter')}>
              {['all', 'problems'].map((key) => (
                <button key={key} type="button" className={`segmented__item${filter === key ? ' is-active' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                  {t(`students.import.show.${key}`)} <span className="mono">{key === 'all' ? preview.summary.total : preview.summary.invalid}</span>
                </button>
              ))}
            </div>

            <div className="table-wrapper import-table">
              <table className="data-table data-table--cards">
                <thead>
                  <tr>
                    <th className="numeric">{t('students.import.line')}</th>
                    <th>{t('students.profile.fullName')}</th>
                    <th>{t('students.fields.gender')}</th>
                    <th>{t('students.fields.dob')}</th>
                    <th>{t('students.classStream')}</th>
                    <th>{t('students.guardian')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const name = [row.values.firstName, row.values.middleName, row.values.lastName].filter(Boolean).join(' ') || '—';
                    const problems = Object.entries(row.errors);
                    return (
                      <Fragment key={row.line}>
                        <tr className={row.valid ? undefined : 'is-invalid'}>
                          <td data-label={t('students.import.line')} className="numeric mono">{row.line}</td>
                          <td data-label={t('students.profile.fullName')}><span className="data-table__primary">{name}</span></td>
                          <td data-label={t('students.fields.gender')}>{row.gender ? t(`gender.${row.gender}`) : row.values.gender || '—'}</td>
                          <td data-label={t('students.fields.dob')} className="mono">{row.dob ? formatDate(row.dob) : row.values.dob || '—'}</td>
                          <td data-label={t('students.classStream')}>{row.placement || row.values.className || '—'}</td>
                          <td data-label={t('students.guardian')}>
                            <span>{row.values.parentName || '—'}</span>
                            <span className="data-table__secondary mono">{row.parentPhone ? formatPhone(row.parentPhone) : row.values.parentPhone}</span>
                          </td>
                          <td data-label={t('common.status')}>
                            {row.valid
                              ? <span className="import-chip import-chip--ok">{t('students.import.ready')}</span>
                              : <span className="import-chip import-chip--bad">{t('students.import.fix')}</span>}
                          </td>
                        </tr>
                        {problems.length > 0 && (
                          <tr className="import-problems-row">
                            <td colSpan={7}>
                              <ul className="import-problems">
                                {problems.map(([field, message]) => (
                                  <li key={field}><strong>{FIELD_LABELS[field] ? t(FIELD_LABELS[field]) : field}:</strong> {message}</li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={7} className="data-table__empty">{t('students.import.noProblems')}</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {stage === 'done' && result && (
          <div className="stack">
            <dl className="import-report">
              <div><dt>{t('students.import.report.total')}</dt><dd className="mono">{result.total}</dd></div>
              <div className="import-report--ok"><dt>{t('students.import.report.imported')}</dt><dd className="mono">{result.imported}</dd></div>
              <div className={result.failed.length ? 'import-report--bad' : undefined}><dt>{t('students.import.report.failed')}</dt><dd className="mono">{result.failed.length}</dd></div>
            </dl>
            <InlineAlert tone={result.failed.length ? 'warning' : 'success'}>
              {t('students.import.done', { count: result.imported })}
              {result.failed.length > 0 && <> {t('students.import.doneSkipped', { count: result.failed.length })}</>}
            </InlineAlert>
            {result.failed.length > 0 && (
              <section className="stack">
                <h3 className="import-step__title">{t('students.import.report.failedTitle')}</h3>
                <ul className="import-failed">
                  {result.failed.map((row) => (
                    <li key={row.line}>
                      <strong>{t('students.import.report.row', { line: row.line })}{row.name ? ` · ${row.name}` : ''}</strong>
                      <ul>{row.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {result.created.length > 0 && <h3 className="import-step__title">{t('students.import.report.createdTitle')}</h3>}
            <ul className="import-created">
              {result.created.map((student) => (
                <li key={student.id}>
                  <span className="reg-no">{student.registrationNumber}</span>
                  <span>{student.fullName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
