import { CircleAlert, Eye, EyeOff, LogIn } from 'lucide-react';
import { useId, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from '../../hooks/useForm.js';

/**
 * Government-style sign-in form (sharp edges, high contrast). `copy` holds the localised labels;
 * `onSuccess(user)` runs after a successful sign-in.
 */
export default function LoginForm({ copy, onSuccess, autoFocus = true }) {
  const { login } = useAuth();
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const { bind, errors, formError, submitting, submit } = useForm({ identifier: '', password: '' });

  const handleSubmit = submit(async ({ identifier, password }) => {
    let user;
    try {
      user = await login(identifier.trim(), password);
    } catch (error) {
      // Translate known sign-in failures by the server's error code (never by HTTP status alone:
      // a 403 can mean an inactive account or a rejected origin). Unknown errors keep the server text.
      const localized = copy.errors?.[error.code];
      if (localized && !error.details) error.message = localized;
      throw error;
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
        <label className="gov-label" htmlFor={`${id}-identifier`}>{copy.identifier}</label>
        <input
          id={`${id}-identifier`}
          name="identifier"
          className="gov-input"
          autoComplete="username"
          placeholder="name@school.ac.tz / 0777 123 456"
          aria-invalid={errors.identifier ? 'true' : undefined}
          aria-describedby={errors.identifier ? `${id}-identifier-error` : undefined}
          autoFocus={autoFocus}
          required
          {...bind('identifier')}
        />
        {errors.identifier && <span id={`${id}-identifier-error`} className="gov-error">{errors.identifier}</span>}
      </div>

      <div className="gov-field">
        <label className="gov-label" htmlFor={`${id}-password`}>{copy.password}</label>
        <div className="gov-input-group">
          <input
            id={`${id}-password`}
            name="password"
            className="gov-input"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={errors.password ? 'true' : undefined}
            aria-describedby={errors.password ? `${id}-password-error` : undefined}
            required
            {...bind('password')}
          />
          <button
            type="button"
            className="gov-input-group__toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? copy.hide : copy.show}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && <span id={`${id}-password-error`} className="gov-error">{errors.password}</span>}
      </div>

      <button type="submit" className="gov-btn gov-btn--primary gov-btn--block" disabled={submitting}>
        {submitting ? <span className="spinner spinner--light" aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
        {submitting ? copy.submitting : copy.submit}
      </button>

      <p className="gov-form__note">{copy.forgot}</p>
    </form>
  );
}
