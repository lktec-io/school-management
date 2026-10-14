import { Plus, Trash2, UserCog, Users } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import FormModal from '../../components/ui/FormModal.jsx';
import { EmptyState, ErrorBlock, InlineAlert, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { useAcademicPeriod } from '../../context/AcademicContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useForm } from '../../hooks/useForm.js';
import { LEVEL_LABELS } from '../../utils/format.js';

function AssignmentModal({ classes, teachers, academicYearId, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({ teacherId: '', classId: '', streamId: '', subjectId: '' });
  const cls = classes.find((item) => String(item.id) === String(form.values.classId));
  const subjects = useApi(cls ? '/academics/subjects' : null, { level: cls?.level });

  return (
    <FormModal
      title="Assign subject to teacher"
      form={form}
      onClose={onClose}
      submitLabel="Assign"
      onSubmit={async (values) => {
        await api.post('/academics/assignments', { ...values, academicYearId });
        toast.success('Subject assigned.');
        onSaved();
      }}
    >
      <FormField label="Teacher" required error={form.errors.teacherId}>
        <select className="form-control" {...form.bind('teacherId')}>
          <option value="">Select teacher…</option>
          {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
        </select>
      </FormField>
      <div className="form-grid form-grid--2">
        <FormField label="Class" required error={form.errors.classId}>
          <select
            className="form-control"
            value={form.values.classId}
            onChange={(event) => {
              form.setField('classId', event.target.value);
              form.setField('streamId', '');
              form.setField('subjectId', '');
            }}
          >
            <option value="">Select class…</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.className} · {LEVEL_LABELS[item.level]}</option>)}
          </select>
        </FormField>
        <FormField label="Stream" error={form.errors.streamId} hint="Leave as “Whole class” to cover all streams">
          <select className="form-control" {...form.bind('streamId')} disabled={!cls?.streams.length}>
            <option value="">Whole class</option>
            {(cls?.streams ?? []).map((stream) => <option key={stream.id} value={stream.id}>Stream {stream.streamName}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Subject" required error={form.errors.subjectId} hint={cls ? `${LEVEL_LABELS[cls.level]} subjects` : 'Choose a class first'}>
        <select className="form-control" {...form.bind('subjectId')} disabled={!cls}>
          <option value="">Select subject…</option>
          {(subjects.data ?? []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}
        </select>
      </FormField>
    </FormModal>
  );
}

function ReassignModal({ assignment, teachers, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({ teacherId: assignment.teacherId });
  return (
    <FormModal
      title={`Reassign ${assignment.subjectName}`}
      form={form}
      onClose={onClose}
      submitLabel="Reassign"
      onSubmit={async (values) => {
        await api.put(`/academics/assignments/${assignment.id}`, values);
        toast.success(`${assignment.subjectName} reassigned.`);
        onSaved();
      }}
    >
      <p className="text-sm">
        {assignment.className}{assignment.streamName ? ` ${assignment.streamName}` : ' (all streams)'} — currently taught by <strong>{assignment.teacherName}</strong>.
      </p>
      <FormField label="New teacher" required error={form.errors.teacherId}>
        <select className="form-control" {...form.bind('teacherId')}>
          {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
        </select>
      </FormField>
    </FormModal>
  );
}

export default function AssignmentsPanel() {
  const { academicYear } = useAcademicPeriod();
  const [filters, setFilters] = useState({ classId: '', teacherId: '' });
  const classes = useApi('/academics/classes');
  const teachers = useApi('/users', { role: 'teacher', status: 'active', pageSize: 200 });
  const { data: assignments, error, loading, reload } = useApi(
    academicYear ? '/academics/assignments' : null,
    { academicYearId: academicYear?.id, ...filters },
  );
  const { run, pending } = useAsyncAction();
  const [modal, setModal] = useState(null);

  if (!academicYear) {
    return (
      <InlineAlert tone="warning" title="No current academic year">
        <p>Set the current academic year on the Calendar tab before assigning teachers.</p>
      </InlineAlert>
    );
  }

  const teacherList = teachers.data?.items ?? [];
  const classList = classes.data ?? [];
  const closeAndReload = () => {
    setModal(null);
    reload();
  };

  return (
    <div className="stack">
      <div className="panel-toolbar">
        <div className="button-row">
          <select className="form-control form-control--inline" aria-label="Filter by class" value={filters.classId}
            onChange={(event) => setFilters((f) => ({ ...f, classId: event.target.value }))}>
            <option value="">All classes</option>
            {classList.map((cls) => <option key={cls.id} value={cls.id}>{cls.className}</option>)}
          </select>
          <select className="form-control form-control--inline" aria-label="Filter by teacher" value={filters.teacherId}
            onChange={(event) => setFilters((f) => ({ ...f, teacherId: event.target.value }))}>
            <option value="">All teachers</option>
            {teacherList.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
          </select>
          <span className="text-sm text-muted">Academic year <span className="mono">{academicYear.yearLabel}</span></span>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'create' })} disabled={!teacherList.length || !classList.length}>
          <Plus size={16} aria-hidden="true" /> Assign subject
        </button>
      </div>
      {!teachers.loading && teacherList.length === 0 && (
        <InlineAlert tone="info" title="No teacher accounts">
          <p>Create teacher accounts under User Accounts before assigning subjects.</p>
        </InlineAlert>
      )}
      {loading && !assignments && <LoadingBlock />}
      <ErrorBlock error={error} onRetry={reload} />
      {assignments && assignments.length === 0 && (
        <EmptyState icon={Users} title="No assignments" message="Assign each subject in each class to the teacher who teaches it." />
      )}
      {assignments && assignments.length > 0 && (
        <section className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class</th><th>Stream</th><th>Subject</th><th>Teacher</th>
                  <th className="actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="data-table__primary">{assignment.className}</td>
                    <td>{assignment.streamName ? `Stream ${assignment.streamName}` : <span className="text-muted">All streams</span>}</td>
                    <td>{assignment.subjectName} <span className="mono text-xs text-muted">{assignment.subjectCode}</span></td>
                    <td>{assignment.teacherName}</td>
                    <td className="actions">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setModal({ type: 'reassign', assignment })}>
                        <UserCog size={14} aria-hidden="true" /> Reassign
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon btn--sm"
                        aria-label={`Remove ${assignment.subjectName} assignment`}
                        disabled={pending === assignment.id}
                        onClick={() => window.confirm(`Remove ${assignment.teacherName} from ${assignment.subjectName} (${assignment.className})?`)
                          && run(assignment.id, () => api.delete(`/academics/assignments/${assignment.id}`), 'Assignment removed.').then(reload)}
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
      {modal?.type === 'create' && (
        <AssignmentModal classes={classList} teachers={teacherList} academicYearId={academicYear.id} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
      {modal?.type === 'reassign' && (
        <ReassignModal assignment={modal.assignment} teachers={teacherList} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
    </div>
  );
}
