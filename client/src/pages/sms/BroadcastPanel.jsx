import { Send } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import MessageComposer from '../../components/sms/MessageComposer.jsx';
import FormField from '../../components/ui/FormField.jsx';
import { InlineAlert } from '../../components/ui/Feedback.jsx';
import { useAcademicPeriod } from '../../context/AcademicContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { FEE_REMINDER_TEMPLATE } from '../../utils/sms.js';
import { useConfirm } from '../../context/ConfirmContext.jsx';

const AUDIENCES = [
  { id: 'all_parents', label: 'All parents', description: 'Guardians of every active student' },
  { id: 'class', label: 'Specific class', description: 'Guardians of one class or stream' },
  { id: 'defaulters', label: 'Unpaid fee parents', description: 'Guardians of students with a balance' },
  { id: 'exam_results', label: 'Examination results', description: 'Each parent receives their child’s result', adminOnly: true },
  { id: 'custom', label: 'Custom numbers', description: 'Paste phone numbers' },
];

const TEMPLATES = {
  all_parents: 'Dear {parent_name}, ',
  class: 'Dear {parent_name}, ',
  defaulters: FEE_REMINDER_TEMPLATE,
  exam_results: 'Dear {parent_name}, {student_name} scored an average of {average} (grade {grade}, division {division}) and was position {position} in {exam}. {school}',
  custom: '',
};

export default function BroadcastPanel({ onSent }) {
  const confirm = useConfirm();
  const { hasRole } = useAuth();
  const toast = useToast();
  const { term } = useAcademicPeriod();
  const [type, setType] = useState('all_parents');
  const [fields, setFields] = useState({ classId: '', streamId: '', termId: term ? String(term.id) : '', examId: '', minBalance: '', phones: '' });
  const [message, setMessage] = useState(TEMPLATES.all_parents);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const classes = useApi('/academics/classes');
  const years = useApi('/academics/years');
  const exams = useApi(type === 'exam_results' ? '/exams' : null, { status: 'published' });

  const streams = (classes.data ?? []).find((cls) => String(cls.id) === fields.classId)?.streams ?? [];
  const set = (changes) => setFields((current) => ({ ...current, ...changes }));

  const target = { type };
  if (['class', 'defaulters', 'exam_results'].includes(type)) {
    if (fields.classId) target.classId = Number(fields.classId);
    if (fields.streamId) target.streamId = Number(fields.streamId);
  }
  if (['defaulters', 'all_parents', 'class'].includes(type) && fields.termId) target.termId = Number(fields.termId);
  if (type === 'defaulters' && fields.minBalance) target.minBalance = Number(fields.minBalance);
  if (type === 'exam_results' && fields.examId) target.examId = Number(fields.examId);
  if (type === 'custom') target.phones = fields.phones.split(/[\s,;]+/).filter(Boolean);

  const ready = (type !== 'class' || Boolean(target.classId))
    && (type !== 'exam_results' || (Boolean(target.examId) && Boolean(target.classId)))
    && (type !== 'custom' || target.phones.length > 0);

  const chooseAudience = (id) => {
    setType(id);
    setMessage(TEMPLATES[id]);
    setError(null);
  };

  const send = async () => {
    if (!(await confirm(`Send this SMS to ${preview.recipients} recipient(s) using about ${preview.totalSegments} credits?`))) return;
    setSending(true);
    setError(null);
    try {
      const result = await api.post('/sms/send-bulk', { target, message });
      toast.success(`${result.queued} message(s) queued for delivery.`);
      onSent(result.batchId);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="broadcast">
      <section className="card">
        <div className="card__header"><h2 className="card__title">1. Audience</h2></div>
        <div className="card__body stack">
          <div className="audience-grid" role="radiogroup" aria-label="Target group">
            {AUDIENCES.filter((a) => !a.adminOnly || hasRole('admin')).map((audience) => (
              <button
                key={audience.id}
                type="button"
                role="radio"
                aria-checked={type === audience.id}
                className={`audience-option${type === audience.id ? ' is-active' : ''}`}
                onClick={() => chooseAudience(audience.id)}
              >
                <strong>{audience.label}</strong>
                <span>{audience.description}</span>
              </button>
            ))}
          </div>

          <div className="form-grid form-grid--3">
            {['class', 'defaulters', 'exam_results'].includes(type) && (
              <>
                <FormField label="Class" required={type !== 'defaulters'}>
                  <select className="form-control" value={fields.classId} onChange={(event) => set({ classId: event.target.value, streamId: '' })}>
                    <option value="">{type === 'defaulters' ? 'All classes' : 'Select class…'}</option>
                    {(classes.data ?? []).map((cls) => <option key={cls.id} value={cls.id}>{cls.className}</option>)}
                  </select>
                </FormField>
                <FormField label="Stream">
                  <select className="form-control" value={fields.streamId} onChange={(event) => set({ streamId: event.target.value })} disabled={!streams.length}>
                    <option value="">All streams</option>
                    {streams.map((stream) => <option key={stream.id} value={stream.id}>Stream {stream.streamName}</option>)}
                  </select>
                </FormField>
              </>
            )}
            {['defaulters', 'all_parents', 'class'].includes(type) && (
              <FormField label="Term for {balance}" hint={type === 'defaulters' ? 'Balances are for this term' : 'Only used if the message includes {balance}'}>
                <select className="form-control" value={fields.termId} onChange={(event) => set({ termId: event.target.value })}>
                  {(years.data ?? []).map((year) => (
                    <optgroup key={year.id} label={year.yearLabel}>
                      {year.terms.map((t) => <option key={t.id} value={t.id}>{t.termName} {year.yearLabel}</option>)}
                    </optgroup>
                  ))}
                </select>
              </FormField>
            )}
            {type === 'defaulters' && (
              <FormField label="Minimum balance (TZS)">
                <input className="form-control mono" inputMode="decimal" value={fields.minBalance} onChange={(event) => set({ minBalance: event.target.value.replace(/[^\d.]/g, '') })} />
              </FormField>
            )}
            {type === 'exam_results' && (
              <FormField label="Published examination" required>
                <select className="form-control" value={fields.examId} onChange={(event) => set({ examId: event.target.value })}>
                  <option value="">Select…</option>
                  {(exams.data ?? []).map((exam) => <option key={exam.id} value={exam.id}>{exam.name} — {exam.termName} {exam.yearLabel}</option>)}
                </select>
              </FormField>
            )}
            {type === 'custom' && (
              <FormField label="Phone numbers" required className="span-all" hint="Separate with commas, spaces or new lines, e.g. 0777 123 456, 0655 987 654">
                <textarea className="form-control mono" rows={3} value={fields.phones} onChange={(event) => set({ phones: event.target.value })} />
              </FormField>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header"><h2 className="card__title">2. Message</h2></div>
        <div className="card__body stack">
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
          <MessageComposer target={target} targetReady={ready} value={message} onChange={setMessage} onPreview={setPreview} />
        </div>
        <div className="card__footer form-actions form-actions--flush">
          <button type="button" className="btn btn--primary btn--lg" onClick={send} disabled={!preview || preview.recipients === 0 || sending}>
            {sending ? <span className="spinner spinner--light" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
            {sending ? 'Queuing messages…' : `Send to ${preview?.recipients ?? 0} recipient${preview?.recipients === 1 ? '' : 's'}`}
          </button>
        </div>
      </section>
    </div>
  );
}
