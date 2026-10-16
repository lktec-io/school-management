import { ArrowLeft, Hash, Save, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import { EmptyState, ErrorBlock, InlineAlert, PageSkeleton } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PhotoPicker from '../../components/ui/PhotoPicker.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSchoolProfile } from '../../hooks/useSchoolProfile.js';
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

function FormSection({ step, title, description, children }) {
  return (
    <section className="card form-section">
      <header className="form-section__head">
        <span className="form-section__step mono" aria-hidden="true">{step}</span>
        <div>
          <h2 className="form-section__title">{title}</h2>
          {description && <p className="form-section__description">{description}</p>}
        </div>
      </header>
      <div className="form-grid form-grid--3 form-section__body">{children}</div>
    </section>
  );
}

function StudentFormBody({ student, classes }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const editing = Boolean(student);
  const initial = useMemo(() => toForm(student), [student]);
  const { values, bind, setField, errors, formError, submitting, submit } = useForm(initial);
  // undefined = unchanged, data URL = new photo, null = remove the saved photo.
  const [photo, setPhoto] = useState(undefined);
  const parents = useApi('/users', { role: 'parent', status: 'active', pageSize: 200 });
  const school = useSchoolProfile();

  const streams = classes.find((cls) => String(cls.id) === String(values.classId))?.streams ?? [];
  const normalisedPhone = previewPhone(values.parentPhone);
  const admissionYear = (values.admissionDate || todayIso()).slice(0, 4);
  const fullName = [values.firstName, values.middleName, values.lastName].filter(Boolean).join(' ');

  const savePhoto = async (studentId) => {
    if (photo === undefined) return;
    try {
      if (photo === null) await api.delete(`/students/${studentId}/photo`);
      else await api.put(`/students/${studentId}/photo`, { dataUrl: photo });
    } catch (error) {
      // The record itself is saved; surface the photo problem without losing it.
      toast.error(t('students.photo.failed', { message: error.message }));
    }
  };

  const handleSubmit = submit(async (form) => {
    if (editing) {
      const changes = {};
      for (const field of FIELDS) {
        const before = field === 'parentPhone' ? previewPhone(initial[field]) : initial[field];
        const after = field === 'parentPhone' ? previewPhone(form[field]) ?? form[field] : form[field];
        if (String(before ?? '') !== String(after ?? '')) changes[field] = form[field] === '' ? null : form[field];
      }
      if (Object.keys(changes).length === 0 && photo === undefined) {
        toast.info(t('students.form.noChanges'));
        navigate(`/students/${student.id}`);
        return;
      }
      if (Object.keys(changes).length > 0) await api.put(`/students/${student.id}`, changes);
      await savePhoto(student.id);
      toast.success(t('students.form.updated', { name: fullName }));
      navigate(`/students/${student.id}`);
    } else {
      const saved = await api.post('/students', form);
      await savePhoto(saved.id);
      toast.success(t('students.form.registered', { name: saved.fullName, regNo: saved.registrationNumber }));
      navigate(`/students/${saved.id}`);
    }
  });

  return (
    <form className="student-form" onSubmit={handleSubmit} noValidate>
      <div className="student-form__main stack-lg">
        {formError && !Object.keys(errors).length && <InlineAlert tone="danger">{formError}</InlineAlert>}

        <FormSection step="01" title={t('students.form.bio')} description={t('students.form.bioHint')}>
          <FormField label={t('students.fields.firstName')} required error={errors.firstName}>
            <input className="form-control" autoComplete="off" {...bind('firstName')} />
          </FormField>
          <FormField label={t('students.fields.middleName')} error={errors.middleName}>
            <input className="form-control" autoComplete="off" {...bind('middleName')} />
          </FormField>
          <FormField label={t('students.fields.lastName')} required error={errors.lastName}>
            <input className="form-control" autoComplete="off" {...bind('lastName')} />
          </FormField>
          <FormField label={t('students.fields.gender')} required error={errors.gender}>
            <div className="choice-group" role="radiogroup">
              {['female', 'male'].map((gender) => (
                <label key={gender} className={`choice${values.gender === gender ? ' is-selected' : ''}`}>
                  <input type="radio" name="gender" value={gender} checked={values.gender === gender}
                    onChange={() => setField('gender', gender)} />
                  {t(`gender.${gender}`)}
                </label>
              ))}
            </div>
          </FormField>
          <FormField label={t('students.fields.dob')} required error={errors.dob}>
            <input className="form-control mono" type="date" max={todayIso()} {...bind('dob')} />
          </FormField>
          <FormField label={t('students.fields.address')} error={errors.address}>
            <input className="form-control" {...bind('address')} placeholder={t('students.fields.addressPlaceholder')} />
          </FormField>
        </FormSection>

        <FormSection step="02" title={t('students.form.placement')} description={t('students.form.placementHint')}>
          <FormField label={t('common.class')} required error={errors.classId}>
            <select
              className="form-control"
              value={values.classId}
              onChange={(event) => {
                setField('classId', event.target.value);
                setField('streamId', '');
              }}
            >
              <option value="">{t('students.fields.selectClass')}</option>
              {groupClassesByLevel(classes).map(([level, list]) => (
                <optgroup key={level} label={LEVEL_LABELS[level]}>
                  {list.map((cls) => <option key={cls.id} value={cls.id}>{cls.className}</option>)}
                </optgroup>
              ))}
            </select>
          </FormField>
          <FormField label={t('common.stream')} error={errors.streamId} hint={values.classId && !streams.length ? t('students.fields.noStreams') : null}>
            <select className="form-control" {...bind('streamId')} disabled={!streams.length}>
              <option value="">{streams.length ? t('students.fields.selectStream') : '—'}</option>
              {streams.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.streamName}{stream.capacity ? ` (${stream.activeStudents}/${stream.capacity})` : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t('students.fields.admissionDate')} error={errors.admissionDate} hint={editing ? t('students.fields.admissionLocked') : t('students.fields.admissionHint')}>
            <input className="form-control mono" type="date" max={todayIso()} {...bind('admissionDate')} disabled={editing} />
          </FormField>
        </FormSection>

        <FormSection step="03" title={t('students.form.guardian')} description={t('students.form.guardianHint')}>
          <FormField label={t('students.fields.guardianName')} required error={errors.parentName}>
            <input className="form-control" {...bind('parentName')} />
          </FormField>
          <FormField
            label={t('students.fields.guardianPhone')}
            required
            error={errors.parentPhone}
            hint={values.parentPhone
              ? normalisedPhone ? t('students.fields.phoneSaved', { phone: normalisedPhone }) : t('students.fields.phoneInvalid')
              : t('students.fields.phoneHint')}
          >
            <input className="form-control mono" inputMode="tel" placeholder="0777 123 456" {...bind('parentPhone')} />
          </FormField>
          <FormField label={t('students.fields.parentAccount')} error={errors.parentUserId} hint={t('students.fields.parentAccountHint')}>
            <select className="form-control" {...bind('parentUserId')}>
              <option value="">{t('students.fields.notLinked')}</option>
              {(parents.data?.items ?? []).map((parent) => (
                <option key={parent.id} value={parent.id}>{parent.fullName} — {parent.phone || parent.email}</option>
              ))}
            </select>
          </FormField>
        </FormSection>
      </div>

      <aside className="student-form__aside">
        <section className="card">
          <div className="card__header"><h2 className="card__title">{t('students.photo.title')}</h2></div>
          <div className="card__body">
            <PhotoPicker name={fullName} value={photo} currentUrl={student?.photoUrl} onChange={setPhoto} removable={editing} disabled={submitting} />
          </div>
        </section>
        <section className="card">
          <div className="card__body stack">
            <div className="regno-preview">
              <Hash size={16} aria-hidden="true" />
              <div>
                <span className="regno-preview__label">{t('students.fields.regNo')}</span>
                <span className="reg-no">{editing ? student.registrationNumber : `${school?.regNumberPrefix ?? '…'}/${admissionYear}/###`}</span>
              </div>
            </div>
            {!editing && <p className="text-xs text-muted">{t('students.form.regNoHint')}</p>}
            <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
              {editing ? <Save size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
              {submitting ? t('common.saving') : editing ? t('common.saveChanges') : t('students.register')}
            </button>
            <Link to={editing ? `/students/${student.id}` : '/students'} className="btn btn--outline btn--block">{t('common.cancel')}</Link>
          </div>
        </section>
      </aside>
    </form>
  );
}

/** /students/register and /students/:id/edit — full-page student form with photo upload. */
export default function StudentForm() {
  const { t } = useTranslation();
  const { id } = useParams();
  const editing = Boolean(id);
  const classes = useApi('/academics/classes');
  const profile = useApi(editing ? `/students/${id}` : null);

  const loading = classes.loading || (editing && profile.loading);
  const error = classes.error || profile.error;
  const student = profile.data?.student ?? null;

  return (
    <div className="stack-lg">
      <Link to={editing ? `/students/${id}` : '/students'} className="back-link">
        <ArrowLeft size={14} aria-hidden="true" /> {editing ? t('students.backToProfile') : t('students.allStudents')}
      </Link>
      <PageHeader
        eyebrow={editing && student ? <span className="reg-no">{student.registrationNumber}</span> : t('students.eyebrow')}
        title={editing ? t('students.form.editTitle', { name: student?.fullName ?? '' }) : t('students.form.registerTitle')}
        subtitle={editing ? t('students.form.editSubtitle') : t('students.form.registerSubtitle')}
      />
      <ErrorBlock error={error} onRetry={() => { classes.reload(); profile.reload(); }} />
      {loading && !error && <PageSkeleton />}
      {!loading && classes.data && classes.data.length === 0 && (
        <EmptyState title={t('students.form.noClasses')} message={t('students.form.noClassesHint')}
          action={<Link to="/academics?tab=classes" className="btn btn--primary">{t('nav.items.academics')}</Link>} />
      )}
      {!loading && classes.data?.length > 0 && (!editing || student) && (
        <StudentFormBody key={student?.id ?? 'new'} student={student} classes={classes.data} />
      )}
    </div>
  );
}
