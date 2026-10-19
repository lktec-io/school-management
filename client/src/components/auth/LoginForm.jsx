import { CircleAlert, Eye, EyeOff, LogIn, Phone } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { useSchoolProfile } from '../../hooks/useSchoolProfile.js';
import Modal from '../ui/Modal.jsx';

const REMEMBER_KEY = 'school-login-identifier';

function savedIdentifier() {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) || '';
  } catch {
    return '';
  }
}

/** "Forgot password?" — resets are done by the school office (no email reset exists), so show how to reach it. */
function ForgotPasswordDialog({ onClose }) {
  const { t } = useTranslation();
  const school = useSchoolProfile();
  const phones = String(school?.phone || '').split(/[/|,;]/).map((part) => part.trim()).filter(Boolean);
  return (
    <Modal
      title={t('login.forgotTitle')}
      size="sm"
      onClose={onClose}
      footer={<button type="button" className="btn btn--primary" onClick={onClose}>{t('common.close')}</button>}
    >
      <div className="stack">
        <p>{t('login.forgotBody')}</p>
        {phones.length > 0 && (
          <ul className="forgot-phones">
            {phones.map((phone) => (
              <li key={phone}>
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="btn btn--outline"><Phone size={16} aria-hidden="true" /> <span className="mono">{phone}</span></a>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">{t('login.forgotNote')}</p>
      </div>
    </Modal>
  );
}

/** Sign-in form; `onSuccess(user)` runs after a successful sign-in. */
export default function LoginForm({ onSuccess, autoFocus = true }) {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [initialIdentifier] = useState(savedIdentifier);
  const { bind, bindCheckbox, errors, formError, submitting, submit } = useForm({
    identifier: initialIdentifier,
    password: '',
    remember: Boolean(initialIdentifier),
  });

  const handleSubmit = submit(async ({ identifier, password, remember }) => {
    let user;
    try {
      user = await login(identifier.trim(), password, remember);
    } catch (error) {
      // Translate known sign-in failures by the server's error code (never by HTTP status alone:
      // a 403 can mean an inactive account or a rejected origin). Unknown errors keep the server text.
      const key = `login.errors.${error.code}`;
      const localized = error.code && i18n.exists(key) ? t(key) : null;
      if (localized && !error.details) error.message = localized;
      throw error;
    }
    // "Remember me" keeps the session after the browser closes and pre-fills the email/phone next
    // time. The password is never stored in the browser.
    try {
      if (remember) window.localStorage.setItem(REMEMBER_KEY, identifier.trim());
      else window.localStorage.removeItem(REMEMBER_KEY);
    } catch {
      // Storage unavailable (private mode): the session cookie still follows the choice.
    }
    onSuccess(user);
  });

  const generalError = formError && !errors.identifier && !errors.password;

  return (
    <form className="gov-form" onSubmit={handleSubmit} noValidate>
      {generalError && (
        <div className="gov-alert" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <div className="gov-field">
        <label className="gov-label" htmlFor={`${id}-identifier`}>{t('login.identifier')}</label>
        <input
          id={`${id}-identifier`}
          name="identifier"
          className="gov-input"
          autoComplete="username"
          placeholder="name@school.ac.tz / 0777 123 456"
          aria-invalid={errors.identifier ? 'true' : undefined}
          aria-describedby={errors.identifier ? `${id}-identifier-error` : undefined}
          autoFocus={autoFocus && !initialIdentifier}
          required
          {...bind('identifier')}
        />
        {errors.identifier && <span id={`${id}-identifier-error`} className="gov-error">{errors.identifier}</span>}
      </div>

      <div className="gov-field">
        <label className="gov-label" htmlFor={`${id}-password`}>{t('login.password')}</label>
        <div className="gov-input-group">
          <input
            id={`${id}-password`}
            name="password"
            className="gov-input"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={errors.password ? 'true' : undefined}
            aria-describedby={errors.password ? `${id}-password-error` : undefined}
            autoFocus={autoFocus && Boolean(initialIdentifier)}
            required
            {...bind('password')}
          />
          <button
            type="button"
            className="gov-input-group__toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? t('login.hide') : t('login.show')}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && <span id={`${id}-password-error`} className="gov-error">{errors.password}</span>}
      </div>

      <div className="login-options">
        <label className="login-options__remember">
          <input {...bindCheckbox('remember')} /> {t('login.remember')}
        </label>
        <button type="button" className="login-options__forgot" onClick={() => setForgotOpen(true)}>{t('login.forgotLink')}</button>
      </div>

      <button type="submit" className="gov-btn gov-btn--primary gov-btn--block" disabled={submitting}>
        {submitting ? <span className="spinner spinner--light" aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
        {submitting ? t('login.submitting') : t('login.submit')}
      </button>

      {forgotOpen && <ForgotPasswordDialog onClose={() => setForgotOpen(false)} />}
    </form>
  );
}
