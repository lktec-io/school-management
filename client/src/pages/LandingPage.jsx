import {
  ArrowRight, BookOpenCheck, ExternalLink, GraduationCap, LayoutDashboard, LogIn, Mail, MapPin, Megaphone, Menu,
  MessageSquareText, Phone, ShieldCheck, Target, Telescope, UsersRound, Wallet, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Crest from '../components/layout/Crest.jsx';
import HeroSlideshow from '../components/landing/HeroSlideshow.jsx';
import LanguageSwitch from '../components/ui/LanguageSwitch.jsx';
import { COPY, LEADERS, SLIDES } from '../content/landing.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useSchoolProfile } from '../hooks/useSchoolProfile.js';
import { formatPhone } from '../utils/format.js';
import '../styles/landing.css';

const SECTIONS = [
  { id: 'huduma', key: 'features' },
  { id: 'kuhusu', key: 'about' },
  { id: 'masomo', key: 'academics' },
  { id: 'matangazo', key: 'announcements' },
  { id: 'mawasiliano', key: 'contact' },
];
const FEATURE_ICONS = { academic: GraduationCap, finance: Wallet, parents: UsersRound, sms: MessageSquareText };

function initialsOf(name = '') {
  return name.replace(/\b(Mhe|Dkt|Dr|Prof|Mwl|H\.E)\.\s*/g, '').split(/\s+/).filter((part) => /^[A-Za-z]/.test(part))
    .slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '—';
}

function LeaderCard({ leader, name, title }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="leader">
      <div className="leader__photo">
        {failed
          ? <span className="leader__initials" aria-hidden="true">{initialsOf(name)}</span>
          : <img src={leader.photo} alt={name} loading="lazy" onError={() => setFailed(true)} />}
      </div>
      <figcaption>
        <span className="leader__name">{name}</span>
        <span className="leader__title">{title}</span>
      </figcaption>
    </figure>
  );
}

function SectionHead({ eyebrow, title, lead }) {
  return (
    <header className="section-head">
      <span className="section-head__eyebrow">{eyebrow}</span>
      <h2 className="section-head__title">{title}</h2>
      {lead && <p className="section-head__lead">{lead}</p>}
    </header>
  );
}

/** Public website of the school. Every sign-in action goes to the dedicated /login page. */
export default function LandingPage() {
  const { status } = useAuth();
  const { i18n } = useTranslation();
  const school = useSchoolProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const announcements = useApi('/announcements', { limit: 6 });
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'sw';
  const t = COPY[lang];
  const authenticated = status === 'authenticated';

  useEffect(() => {
    if (school?.name) document.title = school.name;
  }, [school?.name]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const portalLink = (className, label = t.nav.login) => (authenticated ? (
    <Link to="/dashboard" className={className}><LayoutDashboard size={17} aria-hidden="true" /> {t.nav.openPortal}</Link>
  ) : (
    <Link to="/login" className={className}><LogIn size={17} aria-hidden="true" /> {label}</Link>
  ));

  const year = new Date().getFullYear();

  return (
    <div className="site">
      <a href="#yaliyomo" className="skip-link">{t.skip}</a>

      {/* ---- Header ------------------------------------------------------ */}
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="site-container site-header__inner">
          <a href="#mwanzo" className="site-brand" onClick={() => setMenuOpen(false)}>
            <Crest name={school?.name || ''} size={40} logoSrc={school?.logoSrc} />
            <span className="site-brand__text">
              <span className="site-brand__name">{school?.name || ' '}</span>
              {school?.motto && <span className="site-brand__motto">{school.motto}</span>}
            </span>
          </a>
          <nav id="site-nav" className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label={t.nav.menu}>
            {SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`} onClick={() => setMenuOpen(false)}>{t.nav[section.key]}</a>
            ))}
          </nav>
          <div className="site-header__actions">
            <LanguageSwitch />
            {portalLink('site-btn site-btn--primary site-header__login')}
            <button
              type="button"
              className="site-header__toggle"
              aria-expanded={menuOpen}
              aria-controls="site-nav"
              aria-label={t.nav.menu}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <main id="yaliyomo">
        {/* ---- Hero ------------------------------------------------------ */}
        <section id="mwanzo" className="hero" aria-label={t.nav.home}>
          <div className="site-container hero__inner">
            <div className="hero__copy">
              <span className="hero__eyebrow"><ShieldCheck size={15} aria-hidden="true" /> {t.registered}</span>
              <h1 className="hero__title">{school?.name || t.hero.eyebrow}</h1>
              {school?.motto && <p className="hero__motto">“{school.motto}”</p>}
              <p className="hero__intro">{t.hero.intro}</p>
              <div className="hero__actions">
                {portalLink('site-btn site-btn--accent site-btn--lg', t.hero.primary)}
                <a href="#huduma" className="site-btn site-btn--ghost site-btn--lg">{t.hero.secondary} <ArrowRight size={17} aria-hidden="true" /></a>
              </div>
              <dl className="hero__highlights">
                {t.hero.highlights.map((item) => (
                  <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                ))}
              </dl>
            </div>
            <div className="hero__media">
              <HeroSlideshow slides={SLIDES} lang={lang} labels={{ ...t.slideshow, region: school?.name || t.nav.home, dots: t.slideshow.goTo }} />
            </div>
          </div>
        </section>

        {/* ---- Features -------------------------------------------------- */}
        <section id="huduma" className="site-section">
          <div className="site-container">
            <SectionHead eyebrow={t.features.eyebrow} title={t.features.title} lead={t.features.lead} />
            <div className="feature-grid">
              {t.features.items.map((feature) => {
                const Icon = FEATURE_ICONS[feature.key] ?? BookOpenCheck;
                return (
                  <article key={feature.key} className="feature-card">
                    <span className="feature-card__icon" aria-hidden="true"><Icon size={22} /></span>
                    <h3 className="feature-card__title">{feature.title}</h3>
                    <p>{feature.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---- About ----------------------------------------------------- */}
        <section id="kuhusu" className="site-section site-section--tinted">
          <div className="site-container">
            <SectionHead eyebrow={t.about.eyebrow} title={t.about.title} lead={t.about.lead} />
            <div className="about-grid">
              <article className="about-card about-card--accent">
                <span className="about-card__icon" aria-hidden="true"><Telescope size={20} /></span>
                <h3>{t.about.vision}</h3>
                <p>{school?.vision || t.about.defaultVision}</p>
              </article>
              <article className="about-card">
                <span className="about-card__icon" aria-hidden="true"><Target size={20} /></span>
                <h3>{t.about.mission}</h3>
                <p>{school?.mission || t.about.defaultMission}</p>
              </article>
              <article className="about-card">
                <span className="about-card__icon" aria-hidden="true"><UsersRound size={20} /></span>
                <h3>{t.about.values}</h3>
                <ul>{t.about.valueList.map((value) => <li key={value.title}><strong>{value.title}</strong> — {value.text}</li>)}</ul>
              </article>
              <article className="about-card">
                <span className="about-card__icon" aria-hidden="true"><ShieldCheck size={20} /></span>
                <h3>{t.about.standards}</h3>
                <ul>{t.about.standardList.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            </div>

            <div className="leadership">
              <h3 className="leadership__heading">{t.leadership}</h3>
              <div className="leadership__list">
                {LEADERS.map((leader) => (
                  <LeaderCard key={leader.id} leader={leader} name={leader.name ?? school?.headmasterName ?? leader.title[lang]} title={leader.title[lang]} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---- Academics ------------------------------------------------- */}
        <section id="masomo" className="site-section">
          <div className="site-container">
            <SectionHead eyebrow={t.academics.eyebrow} title={t.academics.title} lead={t.academics.lead} />
            <div className="level-grid">
              {t.academics.levels.map((level, index) => (
                <article key={level.code} className="level-card">
                  <span className="level-card__index mono">{String(index + 1).padStart(2, '0')}</span>
                  <span className="level-card__code mono">{level.code}</span>
                  <h3 className="level-card__title">{level.title}</h3>
                  <p>{level.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Announcements --------------------------------------------- */}
        <section id="matangazo" className="site-section site-section--tinted">
          <div className="site-container">
            <SectionHead eyebrow={t.announcements.eyebrow} title={t.announcements.title} />
            {announcements.error && <p className="notice-empty">{t.announcements.error}</p>}
            {announcements.data && announcements.data.length === 0 && (
              <p className="notice-empty"><Megaphone size={18} aria-hidden="true" /> {t.announcements.empty}</p>
            )}
            {announcements.data && announcements.data.length > 0 && (
              <div className="notice-grid">
                {announcements.data.map((item) => {
                  const date = new Date(`${item.publishedAt}T12:00:00`);
                  return (
                    <article key={item.id} className="notice">
                      <div className="notice__meta">
                        <span className="notice__category">{t.announcements.categories[item.category] ?? item.category}</span>
                        <time className="mono" dateTime={item.publishedAt}>
                          {date.toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </time>
                      </div>
                      <h3 className="notice__title">{item.title}</h3>
                      <p className="notice__text">{item.body}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ---- Call to action -------------------------------------------- */}
        <section className="cta">
          <div className="site-container cta__inner">
            <div>
              <h2 className="cta__title">{t.cta.title}</h2>
              <p className="cta__text">{t.cta.text}</p>
            </div>
            {portalLink('site-btn site-btn--accent site-btn--lg', t.cta.button)}
          </div>
        </section>
      </main>

      {/* ---- Footer ------------------------------------------------------ */}
      <footer id="mawasiliano" className="site-footer">
        <div className="site-container site-footer__grid">
          <div className="site-footer__brand">
            <Crest name={school?.name || ''} size={48} inverted logoSrc={school?.logoSrc} />
            <div>
              <strong>{school?.name}</strong>
              {school?.motto && <span>“{school.motto}”</span>}
              {school?.registrationNo && <span>{t.registration}: <span className="mono">{school.registrationNo}</span></span>}
            </div>
          </div>
          <div>
            <h3 className="site-footer__heading">{t.footer.contact}</h3>
            <ul className="site-footer__list">
              {school?.address && <li><MapPin size={15} aria-hidden="true" /> {school.address}</li>}
              {school?.phone && <li><Phone size={15} aria-hidden="true" /> <a className="mono" href={`tel:${school.phone.replace(/[^\d+]/g, '')}`}>{formatPhone(school.phone)}</a></li>}
              {school?.email && <li><Mail size={15} aria-hidden="true" /> <a href={`mailto:${school.email}`}>{school.email}</a></li>}
              {school?.website && <li><ExternalLink size={15} aria-hidden="true" /> <a href={school.website} rel="noopener noreferrer">{school.website.replace(/^https?:\/\//, '')}</a></li>}
            </ul>
          </div>
          <div>
            <h3 className="site-footer__heading">{t.footer.quickLinks}</h3>
            <ul className="site-footer__list">
              {SECTIONS.slice(0, 4).map((section) => <li key={section.id}><a href={`#${section.id}`}>{t.nav[section.key]}</a></li>)}
            </ul>
          </div>
          <div>
            <h3 className="site-footer__heading">{t.footer.portal}</h3>
            <p className="site-footer__note">{t.cta.text}</p>
            {portalLink('site-btn site-btn--accent')}
          </div>
        </div>
        <div className="site-footer__bar">
          <div className="site-container">© <span className="mono">{year}</span> {school?.name}. {t.footer.rights}</div>
        </div>
      </footer>
    </div>
  );
}
