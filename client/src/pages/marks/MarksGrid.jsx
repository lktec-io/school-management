import { Lock, RotateCcw, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { InlineAlert } from '../../components/ui/Feedback.jsx';
import { GradeChip } from '../../components/ui/StatusBadge.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatNumber } from '../../utils/format.js';

const SCORE_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

function toRow(student) {
  const original = {
    score: student.isAbsent || student.score === null ? '' : String(student.score),
    isAbsent: Boolean(student.isAbsent),
    remarks: student.remarks ?? '',
  };
  return { ...student, ...original, original };
}

function gradeFor(scale, score, maxScore) {
  if (score === '' || !SCORE_PATTERN.test(score) || Number(score) > maxScore) return null;
  const pct = Math.round((Number(score) / maxScore) * 10000) / 100;
  return scale.find((band) => pct >= band.minScore)?.grade ?? scale[scale.length - 1]?.grade ?? null;
}

function validate(row, maxScore) {
  if (row.isAbsent || row.score === '') return null;
  if (!SCORE_PATTERN.test(row.score)) return 'Enter a number (max 2 decimals)';
  if (Number(row.score) > maxScore) return `Max ${formatNumber(maxScore)}`;
  return null;
}

const isDirty = (row) => row.score !== row.original.score
  || row.isAbsent !== row.original.isAbsent
  || row.remarks.trim() !== row.original.remarks;

/**
 * Spreadsheet-style score entry. Keyboard: Enter / ↓ next student, ↑ previous student,
 * Ctrl+S save. Only changed rows are submitted.
 */
export default function MarksGrid({ sheet, onSaved }) {
  const toast = useToast();
  const [prevSheet, setPrevSheet] = useState(sheet);
  const [rows, setRows] = useState(() => sheet.students.map(toRow));
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState(null);
  const inputs = useRef({});

  // Reset the grid whenever a freshly loaded marksheet arrives.
  if (sheet !== prevSheet) {
    setPrevSheet(sheet);
    setRows(sheet.students.map(toRow));
    setServerErrors(null);
  }

  const { exam, canEdit, gradingScale } = sheet;
  const maxScore = exam.maxScore;
  const dirtyRows = rows.filter(isDirty);
  const errors = Object.fromEntries(rows.map((row) => [row.studentId, validate(row, maxScore)]));
  const invalidCount = Object.values(errors).filter(Boolean).length;
  const entered = rows.filter((row) => row.isAbsent || row.score !== '');
  const scored = rows.filter((row) => !row.isAbsent && row.score !== '' && !errors[row.studentId]);
  const mean = scored.length ? scored.reduce((sum, row) => sum + Number(row.score), 0) / scored.length : null;

  useEffect(() => {
    if (dirtyRows.length === 0) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyRows.length]);

  const update = (studentId, changes) => {
    setRows((current) => current.map((row) => (row.studentId === studentId ? { ...row, ...changes } : row)));
  };

  const focusCell = (index, column) => {
    const node = inputs.current[`${index}-${column}`];
    if (node) {
      node.focus();
      node.select?.();
    }
  };

  const save = async () => {
    if (!dirtyRows.length || invalidCount || saving) return;
    setSaving(true);
    setServerErrors(null);
    try {
      const result = await api.post('/exams/marks/bulk', {
        examId: exam.id,
        subjectId: sheet.subject.id,
        classId: sheet.class.id,
        streamId: sheet.stream?.id ?? null,
        entries: dirtyRows.map((row) => ({
          studentId: row.studentId,
          isAbsent: row.isAbsent,
          score: row.isAbsent || row.score === '' ? null : Number(row.score),
          remarks: row.remarks.trim(),
        })),
      });
      const changed = result.inserted + result.updated + result.cleared;
      toast.success(`${changed} mark${changed === 1 ? '' : 's'} saved for ${sheet.subject.name}.`);
      onSaved(result);
    } catch (error) {
      setServerErrors(error);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event, index, column) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      focusCell(Math.min(index + 1, rows.length - 1), column);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusCell(Math.max(index - 1, 0), column);
    }
  };

  return (
    <section className="card">
      <div className="card__header">
        <div className="card__title-group">
          <h2 className="card__title">{sheet.subject.name} <span className="mono text-muted">{sheet.subject.code}</span></h2>
          <span className="text-sm text-muted">
            {sheet.class.className}{sheet.stream ? ` ${sheet.stream.streamName}` : ' (all streams)'} · {exam.name} · out of{' '}
            <span className="mono">{formatNumber(maxScore)}</span>
          </span>
        </div>
        <div className="marks-stats">
          <span>Entered <strong className="mono">{entered.length}/{rows.length}</strong></span>
          <span>Mean <strong className="mono">{mean === null ? '—' : formatNumber(mean)}</strong></span>
          {dirtyRows.length > 0 && <span className="badge badge--warning">{dirtyRows.length} unsaved</span>}
        </div>
      </div>

      {!canEdit && (
        <div className="card__body">
          <InlineAlert tone="info" title="Marks are locked" icon={Lock}>
            <p>This examination is <strong>{exam.status}</strong>. Marks can only be changed while it is open; ask the Headmaster to reopen it.</p>
          </InlineAlert>
        </div>
      )}
      {serverErrors?.details?.studentIds && (
        <div className="card__body">
          <InlineAlert tone="danger" title="Some students could not be saved">
            <p>{serverErrors.message}. Reload the marksheet and try again.</p>
          </InlineAlert>
        </div>
      )}

      <div className="table-wrapper density-compact marks-grid">
        <table className="data-table">
          <thead>
            <tr>
              <th className="numeric">#</th>
              <th>Reg. No</th>
              <th>Student</th>
              <th>Stream</th>
              <th className="marks-grid__score-col">Score / {formatNumber(maxScore)}</th>
              <th className="center">Absent</th>
              <th className="center">Grade</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="data-table__empty">No students found in this class/stream.</td></tr>
            )}
            {rows.map((row, index) => {
              const error = errors[row.studentId];
              const dirty = isDirty(row);
              return (
                <tr key={row.studentId} className={dirty ? 'is-dirty' : undefined}>
                  <td className="numeric">{index + 1}</td>
                  <td><span className="reg-no">{row.registrationNumber}</span></td>
                  <td>
                    <span className="data-table__primary">{row.fullName}</span>
                    {row.status !== 'active' && <span className="data-table__secondary">({row.status})</span>}
                  </td>
                  <td>{row.streamName || '—'}</td>
                  <td>
                    <input
                      ref={(node) => {
                        inputs.current[`${index}-score`] = node;
                      }}
                      className="form-control mono marks-grid__input"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Score for ${row.fullName}`}
                      aria-invalid={error ? 'true' : undefined}
                      title={error || undefined}
                      value={row.isAbsent ? 'ABS' : row.score}
                      disabled={!canEdit || row.isAbsent}
                      onChange={(event) => update(row.studentId, { score: event.target.value.trim() })}
                      onKeyDown={(event) => handleKeyDown(event, index, 'score')}
                      onFocus={(event) => event.target.select()}
                    />
                    {error && <span className="form-error marks-grid__error">{error}</span>}
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      className="marks-grid__absent"
                      aria-label={`Mark ${row.fullName} absent`}
                      checked={row.isAbsent}
                      disabled={!canEdit}
                      onChange={(event) => update(row.studentId, { isAbsent: event.target.checked, score: event.target.checked ? '' : row.score })}
                    />
                  </td>
                  <td className="center">
                    <GradeChip grade={row.isAbsent ? 'ABS' : gradeFor(gradingScale, row.score, maxScore)} />
                  </td>
                  <td>
                    <input
                      ref={(node) => {
                        inputs.current[`${index}-remarks`] = node;
                      }}
                      className="form-control marks-grid__remarks"
                      maxLength={255}
                      aria-label={`Remarks for ${row.fullName}`}
                      placeholder={canEdit ? 'Optional' : ''}
                      value={row.remarks}
                      disabled={!canEdit}
                      onChange={(event) => update(row.studentId, { remarks: event.target.value })}
                      onKeyDown={(event) => handleKeyDown(event, index, 'remarks')}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="card__footer marks-footer">
          <span className="text-xs text-muted">
            <kbd>Enter</kbd>/<kbd>↓</kbd> next · <kbd>↑</kbd> previous · <kbd>Ctrl</kbd>+<kbd>S</kbd> save · leave blank to clear a mark
          </span>
          <div className="button-row">
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setRows(sheet.students.map(toRow))}
              disabled={!dirtyRows.length || saving}
            >
              <RotateCcw size={16} aria-hidden="true" /> Discard changes
            </button>
            <button type="button" className="btn btn--primary" onClick={save} disabled={!dirtyRows.length || invalidCount > 0 || saving}>
              <Save size={16} aria-hidden="true" />
              {saving ? 'Saving…' : `Save ${dirtyRows.length || ''} mark${dirtyRows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
