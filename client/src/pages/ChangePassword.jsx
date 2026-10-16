import { Check, KeyRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FormField from '../components/ui/FormField.jsx';
import { InlineAlert } from '../components/ui/Feedback.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useForm } from '../hooks/useForm.js';
import { useTranslation } from 'react-i18next';

const RULES = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'A lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'A number', test: (value) => /\d/.test(value) },
  { label: 'A symbol (e.g. # @ ! -)', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export default function ChangePassword() {
  const { t } = useTranslation();
  const { user, changePassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { values, bind, errors, formError, submitting, submit } = useForm({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = submit(async (form) => {
    await changePassword(form);
    toast.success('Your password has been changed.');
    navigate('/dashboard', { replace: true });
  });

  return (
    <div className="narrow-page">
      <PageHeader eyebrow={t('pages.password.eyebrow')} title={t('pages.password.title')} subtitle={t('pages.password.subtitle')} />

      {user.mustChangePassword && (
        <InlineAlert tone="warning" title="Temporary password in use" icon={KeyRound}>
          <p>For your security, choose a new personal password before continuing.</p>
        </InlineAlert>
      )}

      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="card__body stack">
          {formError && !Object.keys(errors).length && <InlineAlert tone="danger">{formError}</InlineAlert>}
          <FormField label={user.mustChangePassword ? 'Temporary password' : 'Current password'} required error={errors.currentPassword}>
            <input className="form-control" type="password" autoComplete="current-password" {...bind('currentPassword')} />
          </FormField>
          <FormField label="New password" required error={errors.newPassword}>
            <input className="form-control" type="password" autoComplete="new-password" {...bind('newPassword')} />
          </FormField>
          <ul className="password-rules" aria-label="Password requirements">
            {RULES.map((rule) => {
              const met = rule.test(values.newPassword);
              return (
                <li key={rule.label} className={met ? 'is-met' : ''}>
                  {met ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
          <FormField label="Confirm new password" required error={errors.confirmPassword}>
            <input className="form-control" type="password" autoComplete="new-password" {...bind('confirmPassword')} />
          </FormField>
        </div>
        <div className="card__footer form-actions form-actions--flush">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            <KeyRound size={16} aria-hidden="true" /> {submitting ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
}
