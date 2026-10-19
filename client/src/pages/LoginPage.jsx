import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm.jsx';
import Crest from '../components/layout/Crest.jsx';
import LanguageSwitch from '../components/ui/LanguageSwitch.jsx';
import { IMAGES } from '../content/landing.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSchoolProfile } from '../hooks/useSchoolProfile.js';
import '../styles/gov.css';
import '../styles/login.css';

const ROLES = ['admin', 'accountant', 'teacher', 'parent'];

/** Sign-in page: full-screen campus photo under a dark overlay with a centred, translucent card. */
export default function LoginPage() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const school = useSchoolProfile();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = school?.name ? `${t('login.title')} · ${school.name}` : t('login.title');
  }, [school?.name, t]);

  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;

  const handleSignedIn = (user) => {
    const from = location.state?.from;
    const target = user.mustChangePassword ? '/account/password' : `${from?.pathname || '/dashboard'}${from?.search || ''}`;
    navigate(target, { replace: true });
  };

  return (
    <div className="login-page" style={{ '--login-image': `url("${IMAGES.login}")` }}>
      <div className="login-page__overlay" aria-hidden="true" />

      <header className="login-topbar">
        <Link to="/" className="login-topbar__back"><ArrowLeft size={16} aria-hidden="true" /> {t('login.backToSite')}</Link>
        <LanguageSwitch className="login-topbar__lang" />
      </header>

      <main className="login-main">
        <div className="login-card">
          <Link to="/" className="login-card__brand">
            <Crest name={school?.name || ''} size={56} inverted logoSrc={school?.logoSrc} />
            <span className="login-card__school">{school?.name || t('topbar.portal')}</span>
            {school?.motto && <span className="login-card__motto">“{school.motto}”</span>}
          </Link>

          <div className="login-card__divider" />

          <h1 className="login-card__title">{t('login.title')}</h1>
          <p className="login-card__subtitle">{t('login.subtitle')}</p>
          <ul className="login-roles" aria-label={t('login.rolesLabel')}>
            {ROLES.map((role) => <li key={role}>{t(`roles.${role}`)}</li>)}
          </ul>

          <LoginForm onSuccess={handleSignedIn} />

          <p className="login-card__legal"><ShieldCheck size={14} aria-hidden="true" /> {t('login.legal')}</p>
        </div>
      </main>

      <footer className="login-footer">© <span className="mono">{new Date().getFullYear()}</span> {school?.name}</footer>
    </div>
  );
}
