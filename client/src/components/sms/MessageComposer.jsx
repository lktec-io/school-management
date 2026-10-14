import { MessageSquareText, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { formatNumber } from '../../utils/format.js';
import { MAX_SEGMENTS, PLACEHOLDER_LABELS, analyzeSms } from '../../utils/sms.js';
import { InlineAlert } from '../ui/Feedback.jsx';

const STUDENT = ['parent_name', 'student_name', 'first_name', 'reg_no', 'class', 'school'];
const PLACEHOLDERS_BY_TARGET = {
  all_parents: [...STUDENT, 'balance', 'term'],
  class: [...STUDENT, 'balance', 'term'],
  defaulters: [...STUDENT, 'balance', 'term'],
  students: [...STUDENT, 'balance', 'term'],
  exam_results: [...STUDENT, 'exam', 'average', 'grade', 'division', 'position', 'class_size', 'remark'],
  custom: ['school'],
};

/**
 * SMS editor with placeholder chips, a live GSM-7/UCS-2 counter and a server-side preview
 * (recipient count, credits needed vs Beem balance, rendered sample).
 * `onPreview(preview|null)` lets the parent enable/disable its send button.
 */
export default function MessageComposer({ target, targetReady, value, onChange, onPreview }) {
  const textareaRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const balance = useApi('/sms/balance');
  const stats = analyzeSms(value);
  const targetKey = JSON.stringify(target);
  const onPreviewRef = useRef(onPreview);

  useEffect(() => {
    onPreviewRef.current = onPreview;
  });

  useEffect(() => {
    if (!targetReady || value.trim().length < 2) {
      const timer = setTimeout(() => {
        setPreview(null);
        setPreviewError(null);
        onPreviewRef.current?.(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    let active = true;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const result = await api.post('/sms/preview', { target: JSON.parse(targetKey), message: value });
        if (!active) return;
        setPreview(result);
        setPreviewError(null);
        onPreviewRef.current?.(result);
      } catch (error) {
        if (!active) return;
        setPreview(null);
        setPreviewError(error.details?.message ? `${error.message}. ${error.details.message}` : error.message);
        onPreviewRef.current?.(null);
      } finally {
        if (active) setPreviewing(false);
      }
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [targetKey, targetReady, value]);

  const insert = (key) => {
    const token = `{${key}}`;
    const node = textareaRef.current;
    if (!node) {
      onChange(`${value}${token}`);
      return;
    }
    const start = node.selectionStart ?? value.length;
    const end = node.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const credit = balance.data?.creditBalance;
  const insufficient = preview && credit !== null && credit !== undefined && preview.totalSegments > credit;
  const tooLong = stats.segments > MAX_SEGMENTS;

  return (
    <div className="composer">
      <div className="composer__chips" aria-label="Insert placeholder">
        {(PLACEHOLDERS_BY_TARGET[target?.type] ?? ['school']).map((key) => (
          <button key={key} type="button" className="chip" onClick={() => insert(key)} title={`Insert {${key}}`}>
            + {PLACEHOLDER_LABELS[key] ?? key}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className="form-control composer__text"
        rows={5}
        maxLength={1000}
        aria-label="Message"
        placeholder="Type your message. Placeholders such as {student_name} are filled in for each parent."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="composer__meter">
        <span className={tooLong ? 'text-danger' : ''}>
          <span className="mono">{stats.characters}</span>/<span className="mono">{stats.limit}</span> characters
        </span>
        <span><span className="mono">{stats.segments}</span> SMS part{stats.segments === 1 ? '' : 's'} (template)</span>
        <span className={stats.encoding === 'UCS-2' ? 'text-danger' : ''}>{stats.encoding}</span>
        {stats.encoding === 'UCS-2' && <span className="text-xs text-muted">Special characters/emoji reduce each part to 70 characters.</span>}
      </div>

      {balance.data && !balance.data.configured && (
        <InlineAlert tone="warning" title="SMS gateway not configured" icon={TriangleAlert}>
          <p>Messages will be logged as failed until BEEM_API_KEY, BEEM_SECRET_KEY and BEEM_SENDER_ID are set on the server.</p>
        </InlineAlert>
      )}
      {previewError && <InlineAlert tone="danger">{previewError}</InlineAlert>}

      <div className="composer__preview">
        <div className="composer__stats">
          <div>
            <span className="eyebrow">Recipients</span>
            <strong className="mono">{previewing ? '…' : preview ? formatNumber(preview.recipients, 0) : '—'}</strong>
            {preview?.invalidPhones > 0 && <span className="text-xs text-danger">{preview.invalidPhones} invalid number(s) skipped</span>}
          </div>
          <div>
            <span className="eyebrow">Credits needed</span>
            <strong className={`mono${insufficient ? ' text-danger' : ''}`}>{previewing ? '…' : preview ? formatNumber(preview.totalSegments, 0) : '—'}</strong>
          </div>
          <div>
            <span className="eyebrow">Beem balance</span>
            <strong className="mono">{balance.loading ? '…' : credit !== null && credit !== undefined ? formatNumber(credit, 0) : '—'}</strong>
          </div>
        </div>
        {insufficient && <p className="text-sm text-danger">Not enough SMS credit for this broadcast. Top up your Beem account first.</p>}
        {preview?.samples?.[0] && (
          <div className="sms-bubble">
            <span className="sms-bubble__to mono"><MessageSquareText size={12} aria-hidden="true" /> {preview.samples[0].phone}</span>
            <p>{preview.samples[0].message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
