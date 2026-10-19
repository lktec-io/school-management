import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import FormModal from '../../components/ui/FormModal.jsx';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useForm } from '../../hooks/useForm.js';
import { LEVEL_LABELS } from '../../utils/format.js';
import { useConfirm } from '../../context/ConfirmContext.jsx';

function ClassModal({ cls, teachers, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({
    className: cls?.className ?? '',
    code: cls?.code ?? '',
    level: cls?.level ?? '',
    sortOrder: cls?.sortOrder ?? 0,
    classTeacherId: cls?.classTeacherId ?? '',
    isActive: cls?.isActive ?? true,
  });
  return (
    <FormModal
      title={cls ? `Edit ${cls.className}` : 'New class'}
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        if (cls) await api.put(`/academics/classes/${cls.id}`, values);
        else await api.post('/academics/classes', values);
        toast.success(`${values.className} saved.`);
        onSaved();
      }}
    >
      <div className="form-grid form-grid--2">
        <FormField label="Class name" required error={form.errors.className} hint="e.g. Form Two, Standard Five">
          <input className="form-control" {...form.bind('className')} />
        </FormField>
        <FormField label="Code" required error={form.errors.code} hint="Short unique code, e.g. F2">
          <input className="form-control mono" {...form.bind('code')} />
        </FormField>
        <FormField label="Level" required error={form.errors.level}>
          <select className="form-control" {...form.bind('level')}>
            <option value="">Select level…</option>
            {Object.entries(LEVEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Display order" error={form.errors.sortOrder} hint="Lower numbers are listed first">
          <input type="number" min={0} max={999} className="form-control mono" {...form.bind('sortOrder')} />
        </FormField>
        <FormField label="Class teacher" error={form.errors.classTeacherId} className="span-2" hint="Writes class teacher remarks on report cards">
          <select className="form-control" {...form.bind('classTeacherId')}>
            <option value="">Not assigned</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
          </select>
        </FormField>
      </div>
      {cls && (
        <label className="form-check">
          <input {...form.bindCheckbox('isActive')} /> Class is active
        </label>
      )}
    </FormModal>
  );
}

function StreamModal({ cls, stream, onClose, onSaved }) {
  const confirm = useConfirm();
  const toast = useToast();
  const form = useForm({
    streamName: stream?.streamName ?? '',
    code: stream?.code ?? '',
    capacity: stream?.capacity ?? '',
    displayOrder: stream?.displayOrder ?? 0,
    isActive: stream?.isActive ?? true,
  });
  return (
    <FormModal
      title={stream ? `Edit stream ${cls.className} ${stream.streamName}` : `New stream — ${cls.className}`}
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        if (stream) await api.put(`/academics/streams/${stream.id}`, values);
        else await api.post('/academics/streams', { ...values, classId: cls.id });
        toast.success(`Stream ${values.streamName} saved.`);
        onSaved();
      }}
    >
      <div className="form-grid form-grid--3">
        <FormField label="Stream name" required error={form.errors.streamName} hint="e.g. A, B, Blue">
          <input className="form-control" {...form.bind('streamName')} />
        </FormField>
        <FormField label="Code" required error={form.errors.code} hint={`e.g. ${cls.code}A`}>
          <input className="form-control mono" {...form.bind('code')} />
        </FormField>
        <FormField label="Capacity" error={form.errors.capacity} hint="Optional">
          <input type="number" min={1} max={500} className="form-control mono" {...form.bind('capacity')} />
        </FormField>
        <FormField label="Display order" error={form.errors.displayOrder} hint="Lower numbers are listed first">
          <input type="number" min={0} max={999} className="form-control mono" {...form.bind('displayOrder')} />
        </FormField>
      </div>
      {stream && (
        <div className="split-row">
          <label className="form-check">
            <input {...form.bindCheckbox('isActive')} /> Stream is active
          </label>
          <button
            type="button"
            className="btn btn--ghost btn--sm text-danger"
            disabled={form.submitting || stream.activeStudents > 0}
            title={stream.activeStudents > 0 ? 'Move students out of this stream first' : undefined}
            onClick={async () => {
              if (!(await confirm(`Delete stream ${stream.streamName}?`))) return;
              try {
                await api.delete(`/academics/streams/${stream.id}`);
                toast.success(`Stream ${stream.streamName} deleted.`);
                onSaved();
              } catch (error) {
                form.setFormError(error.message);
              }
            }}
          >
            <Trash2 size={14} aria-hidden="true" /> Delete stream
          </button>
        </div>
      )}
    </FormModal>
  );
}

export default function ClassesPanel() {
  const confirm = useConfirm();
  const { data: classes, error, loading, reload } = useApi('/academics/classes', { includeInactive: true });
  const teachers = useApi('/users', { role: 'teacher', status: 'active', pageSize: 200 });
  const { run, pending } = useAsyncAction();
  const [modal, setModal] = useState(null);

  const closeAndReload = () => {
    setModal(null);
    reload();
  };

  return (
    <div className="stack">
      <div className="panel-toolbar">
        <p className="text-sm text-muted">Classes group students by level; streams divide a class into sections.</p>
        <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'class' })}>
          <Plus size={16} aria-hidden="true" /> New class
        </button>
      </div>
      {loading && !classes && <LoadingBlock />}
      <ErrorBlock error={error} onRetry={reload} />
      {classes && classes.length === 0 && (
        <EmptyState icon={Layers} title="No classes yet" message="Create classes such as Standard One or Form One to start registering students." />
      )}
      {classes && classes.length > 0 && (
        <section className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class</th><th>Level</th><th>Class teacher</th><th>Streams</th>
                  <th className="numeric">Students</th><th>Status</th>
                  <th className="actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <tr key={cls.id}>
                    <td>
                      <span className="data-table__primary">{cls.className}</span>
                      <span className="data-table__secondary mono">{cls.code}</span>
                    </td>
                    <td>{LEVEL_LABELS[cls.level]}</td>
                    <td>{cls.classTeacherName || <span className="text-muted">Not assigned</span>}</td>
                    <td>
                      <div className="chip-list">
                        {cls.streams.map((stream) => (
                          <button
                            key={stream.id}
                            type="button"
                            className={`chip${stream.isActive ? '' : ' chip--muted'}`}
                            onClick={() => setModal({ type: 'stream', cls, stream })}
                            title="Edit stream"
                          >
                            {stream.streamName}
                            <span className="mono">{stream.activeStudents}{stream.capacity ? `/${stream.capacity}` : ''}</span>
                          </button>
                        ))}
                        <button type="button" className="chip chip--add" onClick={() => setModal({ type: 'stream', cls })}>
                          <Plus size={12} aria-hidden="true" /> Stream
                        </button>
                      </div>
                    </td>
                    <td className="numeric">{cls.activeStudents}</td>
                    <td><StatusBadge status={cls.isActive ? 'active' : 'inactive'} /></td>
                    <td className="actions">
                      <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Edit ${cls.className}`} onClick={() => setModal({ type: 'class', cls })}>
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon btn--sm"
                        aria-label={`Delete ${cls.className}`}
                        disabled={pending === `class-${cls.id}`}
                        onClick={async () => (await confirm(`Delete ${cls.className}? Classes with students or history cannot be deleted — deactivate them instead.`))
                          && run(`class-${cls.id}`, () => api.delete(`/academics/classes/${cls.id}`), 'Class deleted.').then(reload)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modal?.type === 'class' && (
        <ClassModal cls={modal.cls} teachers={teachers.data?.items ?? []} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
      {modal?.type === 'stream' && (
        <StreamModal cls={modal.cls} stream={modal.stream} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
    </div>
  );
}
