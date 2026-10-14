import { Save, UserPlus } from 'lucide-react';
import { useMemo } from 'react';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import { InlineAlert } from '../../components/ui/Feedback.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useForm } from '../../hooks/useForm.js';
import { LEVEL_LABELS, formatPhone, todayIso } from '../../utils/format.js';

const EMPTY_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  gender: '',
  dob: '',
  classId: '',
  streamId: '',
  admissionDate: todayIso(),
  address: '',
  parentName: '',
  parentPhone: '',
  parentUserId: '',
};

const FIELDS = Object.keys(EMPTY_FORM);

function toForm(student) {
  if (!student) return EMPTY_FORM;
  return Object.fromEntries(FIELDS.map((field) => {
    const value = student[field];
    if (field === 'parentPhone') return [field, formatPhone(value)];
    return [field, value === null || value === undefined ? '' : String(value)];
  }));
}

/** Mirrors the server's Tanzanian phone normalisation for a live preview. */
function previewPhone(input) {
  let digits = String(input || '').replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith('255')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return /^[67]\d{8}$/.test(digits) ? `255${digits}` : null;
}

function groupClassesByLevel(classes) {
  const groups = {};
  for (const cls of classes) {
    if (!groups[cls.level]) groups[cls.level] = [];
    groups[cls.level].push(cls);
  }
  return Object.entries(groups);
}

/** Register a new student, or edit an existing one when `student` is provided. */
export default function StudentRegisterModal({ student = null, classes, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(student);
  const initial = useMemo(() => toForm(student), [student]);
  const { values, bind, setField, errors, formError, submitting, submit } = useForm(initial);
  const parents = useApi('/users', { role: 'parent', status: 'active', pageSize: 200 });

  const streams = classes.find((cls) => String(cls.id) === String(values.classId))?.streams ?? [];
  const normalisedPhone = previewPhone(values.parentPhone);

  const handleSubmit = submit(async (form) => {
    if (editing) {
      const changes = {};
      for (const field of FIELDS) {
        const before = field === 'parentPhone' ? previewPhone(initial[field]) : initial[field];
        const after = field === 'parentPhone' ? previewPhone(form[field]) ?? form[field] : form[field];
        if (String(before ?? '') !== String(after ?? '')) changes[field] = form[field] === '' ? null : form[field];
      }
      if (Object.keys(changes).length === 0) {
        toast.info('No changes to save.');
        onClose();
        return;
      }
      const saved = await api.put(`/students/${student.id}`, changes);
      toast.success(`${saved.fullName}'s record has been updated.`);
      onSaved(saved);
    } else {
      const saved = await api.post('/students', form);
      toast.success(`${saved.fullName} registered as ${saved.registrationNumber}.`);
      onSaved(saved);
    }
  });

  const footer = (
    <>
      <button type="button" className="btn btn--outline" onClick={onClose} disabled={submitting}>Cancel</button>
      <button type="submit" form="student-form" className="btn btn--primary" disabled={submitting}>
        {editing ? <Save size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
        {submitting ? 'Saving…' : editing ? 'Save changes' : 'Register student'}
      </button>
    </>
  );

  return (
    <Modal
      title={editing ? `Edit student — ${student.registrationNumber}` : 'Register new student'}
      onClose={onClose}
      footer={footer}
      size="lg"
      closeDisabled={submitting}
    >
      <form id="student-form" onSubmit={handleSubmit} noValidate>
        {formError && !Object.keys(errors).length && <InlineAlert tone="danger">{formError}</InlineAlert>}
        {!editing && (
          <p className="text-sm text-muted">
            A registration number (e.g. <span className="reg-no">ZNZ/2026/001</span>) is generated automatically from the admission year.
          </p>
        )}
        <div className="form-grid form-grid--3">
          <h3 className="form-section-title">Student bio-data</h3>
          <FormField label="First name" required error={errors.firstName}>
            <input className="form-control" autoComplete="off" {...bind('firstName')} />
          </FormField>
          <FormField label="Middle name" error={errors.middleName}>
            <input className="form-control" autoComplete="off" {...bind('middleName')} />
          </FormField>
          <FormField label="Last name" required error={errors.lastName}>
            <input className="form-control" autoComplete="off" {...bind('lastName')} />
          </FormField>
          <FormField label="Gender" required error={errors.gender}>
            <select className="form-control" {...bind('gender')}>
              <option value="">Select…</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </FormField>
          <FormField label="Date of birth" required error={errors.dob}>
            <input className="form-control mono" type="date" max={todayIso()} {...bind('dob')} />
          </FormField>
          <FormField label="Admission date" error={errors.admissionDate} hint={editing ? null : 'Defaults to today'}>
            <input className="form-control mono" type="date" max={todayIso()} {...bind('admissionDate')} disabled={editing} />
          </FormField>

          <h3 className="form-section-title">Placement</h3>
          <FormField label="Class" required error={errors.classId}>
            <select
              className="form-control"
              value={values.classId}
              onChange={(event) => {
                setField('classId', event.target.value);
                setField('streamId', '');
              }}
            >
              <option value="">Select class…</option>
              {groupClassesByLevel(classes).map(([level, list]) => (
                <optgroup key={level} label={LEVEL_LABELS[level]}>
                  {list.map((cls) => <option key={cls.id} value={cls.id}>{cls.className}</option>)}
                </optgroup>
              ))}
            </select>
          </FormField>
          <FormField label="Stream" error={errors.streamId} hint={streams.length ? null : 'This class has no streams'}>
            <select className="form-control" {...bind('streamId')} disabled={!streams.length}>
              <option value="">{streams.length ? 'Select stream…' : '—'}</option>
              {streams.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.streamName}{stream.capacity ? ` (${stream.activeStudents}/${stream.capacity})` : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Home address" error={errors.address}>
            <input className="form-control" {...bind('address')} placeholder="e.g. Mwanakwerekwe, Unguja" />
          </FormField>

          <h3 className="form-section-title">Parent / guardian</h3>
          <FormField label="Guardian full name" required error={errors.parentName}>
            <input className="form-control" {...bind('parentName')} />
          </FormField>
          <FormField
            label="Guardian phone (SMS)"
            required
            error={errors.parentPhone}
            hint={values.parentPhone
              ? normalisedPhone ? `Saved as ${normalisedPhone} for SMS` : 'Enter a Tanzanian mobile number, e.g. 0777 123 456'
              : 'Used for fee reminders and results SMS'}
          >
            <input className="form-control mono" inputMode="tel" placeholder="0777 123 456" {...bind('parentPhone')} />
          </FormField>
          <FormField label="Parent portal account" error={errors.parentUserId} hint="Optional — lets the parent view report cards online">
            <select className="form-control" {...bind('parentUserId')}>
              <option value="">Not linked</option>
              {(parents.data?.items ?? []).map((parent) => (
                <option key={parent.id} value={parent.id}>{parent.fullName} — {parent.phone || parent.email}</option>
              ))}
            </select>
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
