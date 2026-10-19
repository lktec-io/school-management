import { ArrowLeft, FileText, MessageSquareText, Receipt, ShieldCheck } from 'lucide-react';
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

const FEATURES = [
  { key: 'results', icon: FileText },
  { key: 'fees', icon: Receipt },
  { key: 'sms', icon: MessageSquareText },
];

/** Split sign-in page: school photo with tint on the left, compact form on the right (stacked on phones). */
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
    <div className="login-page">
      <aside className="login-visual" style={{ '--login-image': `url("${IMAGES.login}")` }}>
        <div className="login-visual__inner">
          <Link to="/" className="login-brand">
            <Crest name={school?.name || ''} size={52} inverted logoSrc={school?.logoSrc} />
            <span>
              <span className="login-brand__name">{school?.name || t('topbar.portal')}</span>
              {school?.motto && <span className="login-brand__motto">“{school.motto}”</span>}
            </span>
          </Link>
          <div className="login-visual__copy">
            <span className="login-visual__eyebrow">{t('login.heroEyebrow')}</span>
            <h2 className="login-visual__title">{t('login.heroTitle')}</h2>
            <ul className="login-visual__features">
              {FEATURES.map(({ key, icon: Icon }) => (
                <li key={key}>
                  <span className="login-visual__icon" aria-hidden="true"><Icon size={16} /></span>
                  <span><strong>{t(`login.features.${key}.title`)}</strong> — {t(`login.features.${key}.text`)}</span>
                </li>
              ))}
            </ul>
          </div>
          {school?.registrationNo && <p className="login-visual__reg">{t('login.regLabel')} <span className="mono">{school.registrationNo}</span></p>}
        </div>
      </aside>

      <main className="login-panel">
        <div className="login-panel__top">
          <Link to="/" className="login-panel__back"><ArrowLeft size={16} aria-hidden="true" /> {t('login.backToSite')}</Link>
          <LanguageSwitch />
        </div>
        <div className="login-card">
          <div className="login-card__crest"><Crest name={school?.name || ''} size={44} logoSrc={school?.logoSrc} /></div>
          <h1 className="login-card__title">{t('login.title')}</h1>
          <p className="login-card__subtitle">{t('login.subtitle')}</p>
          <LoginForm onSuccess={handleSignedIn} />
          <p className="login-card__legal"><ShieldCheck size={14} aria-hidden="true" /> {t('login.legal')}</p>
        </div>
        <p className="login-panel__copyright">© <span className="mono">{new Date().getFullYear()}</span> {school?.name}</p>
      </main>
    </div>
  );
}
