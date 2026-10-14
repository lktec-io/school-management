import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import FormModal from '../../components/ui/FormModal.jsx';
import { ErrorBlock } from '../../components/ui/Feedback.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useForm } from '../../hooks/useForm.js';
import { formatDate, todayIso } from '../../utils/format.js';

const CATEGORIES = {
  general: 'General / Jumla',
  admissions: 'Admissions / Udahili',
  examinations: 'Examinations / Mitihani',
  events: 'Events / Matukio',
  fees: 'Fees / Ada',
};

function AnnouncementModal({ item, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({
    title: item?.title ?? '',
    body: item?.body ?? '',
    category: item?.category ?? 'general',
    publishedAt: item?.publishedAt ?? todayIso(),
    expiresAt: item?.expiresAt ?? '',
    isPublished: item?.isPublished ?? true,
  });
  return (
    <FormModal
      title={item ? 'Edit announcement' : 'New announcement'}
      form={form}
      size="lg"
      onClose={onClose}
      submitLabel={item ? 'Save changes' : 'Publish'}
      onSubmit={async (values) => {
        if (item) await api.put(`/system/announcements/${item.id}`, values);
        else await api.post('/system/announcements', values);
        toast.success('Announcement saved. It appears on the public website when published.');
        onSaved();
      }}
    >
      <FormField label="Title" required error={form.errors.title}>
        <input className="form-control" maxLength={160} {...form.bind('title')} />
      </FormField>
      <FormField label="Message" required error={form.errors.body} hint="Write in Kiswahili, English or both">
        <textarea className="form-control" rows={6} maxLength={4000} {...form.bind('body')} />
      </FormField>
      <div className="form-grid form-grid--3">
        <FormField label="Category" error={form.errors.category}>
          <select className="form-control" {...form.bind('category')}>
            {Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Publish from" error={form.errors.publishedAt}>
          <input type="date" className="form-control mono" {...form.bind('publishedAt')} />
        </FormField>
        <FormField label="Hide after" error={form.errors.expiresAt} hint="Optional">
          <input type="date" className="form-control mono" {...form.bind('expiresAt')} />
        </FormField>
      </div>
      <label className="form-check"><input {...form.bindCheckbox('isPublished')} /> Published on the website</label>
    </FormModal>
  );
}

/** Headmaster-managed notices for the public landing page ("Matangazo"). */
export default function AnnouncementsCard() {
  const { data, error, reload } = useApi('/system/announcements');
  const { run, pending } = useAsyncAction();
  const [modal, setModal] = useState(null);
  const today = todayIso();

  const statusOf = (item) => {
    if (!item.isPublished) return { status: 'draft', label: 'Hidden' };
    if (item.publishedAt > today) return { status: 'queued', label: 'Scheduled' };
    if (item.expiresAt && item.expiresAt < today) return { status: 'closed', label: 'Expired' };
    return { status: 'active', label: 'Live' };
  };

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title"><Megaphone size={16} aria-hidden="true" className="inline-icon" /> Website announcements</h2>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setModal({})}><Plus size={14} aria-hidden="true" /> New</button>
      </div>
      <div className="card__body stack">
        <p className="text-sm text-muted">Shown under “Matangazo” on the public website (latest six live notices).</p>
        <ErrorBlock error={error} onRetry={reload} />
        <ul className="doc-list">
          {data?.length === 0 && <li className="text-muted">No announcements yet.</li>}
          {(data ?? []).map((item) => {
            const state = statusOf(item);
            return (
              <li key={item.id}>
                <span>
                  <strong className="text-sm">{item.title}</strong>
                  <span className="data-table__secondary"><span className="mono">{formatDate(item.publishedAt)}</span> · {CATEGORIES[item.category]}</span>
                </span>
                <span className="button-row">
                  <StatusBadge status={state.status} label={state.label} />
                  <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Edit ${item.title}`} onClick={() => setModal({ item })}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Delete ${item.title}`} disabled={pending === item.id}
                    onClick={() => window.confirm(`Delete “${item.title}”?`) && run(item.id, () => api.delete(`/system/announcements/${item.id}`), 'Announcement deleted.').then(reload)}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {modal && <AnnouncementModal item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </section>
  );
}
