import {
  ArrowRight, BellRing, CheckCircle2, ExternalLink, FileText, LayoutDashboard, LogIn, Mail, MapPin, Megaphone, Menu,
  Phone, Receipt, ShieldCheck, Target, Telescope, Wallet, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Crest from '../components/layout/Crest.jsx';
import LanguageSwitch from '../components/ui/LanguageSwitch.jsx';
import { COPY, IMAGES, SLIDES, STAFF } from '../content/landing.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useSchoolProfile } from '../hooks/useSchoolProfile.js';
import { formatPhone } from '../utils/format.js';
import '../styles/landing.css';

const SECTIONS = [
  { id: 'kuhusu', key: 'overview' },
  { id: 'michepuo', key: 'streams' },
  { id: 'uongozi', key: 'administration' },
  { id: 'wazazi', key: 'parents' },
  { id: 'matangazo', key: 'announcements' },
];
const PARENT_ICONS = { reports: FileText, fees: Wallet, receipts: Receipt, sms: BellRing };
const SLIDE_MS = 6500;

function initialsOf(text = '') {
  return text.replace(/\b(Mhe|Dkt|Dr|Prof|Mwl|Mr|Mrs|Ms|Bw|Bi)\.\s*/g, '').split(/\s+/).filter((part) => /^[A-Za-z]/.test(part))
    .slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '—';
}

/** Cross-fading background photos behind the hero text (paused for reduced-motion users). */
function HeroBackground({ lang }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (SLIDES.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="hero__bg" aria-hidden="true">
      {SLIDES.map((slide, slideIndex) => (
        <img
          key={slide.id}
          src={slide.image}
          alt={slide.alt[lang]}
          className={slideIndex === index ? 'is-active' : undefined}
          loading={slideIndex === 0 ? 'eager' : 'lazy'}
          fetchPriority={slideIndex === 0 ? 'high' : undefined}
        />
      ))}
    </div>
  );
}

function StaffCard({ member, name, lang }) {
  const [failed, setFailed] = useState(false);
  const role = member.role[lang];
  return (
    <article className="staff-card">
      <div className="staff-card__photo">
        {/* Initials sit underneath; the portrait covers them once it loads (and is dropped if missing). */}
        <span className="staff-card__initials" aria-hidden="true">{initialsOf(name || role)}</span>
        {!failed && <img src={member.photo} alt={name || role} loading="lazy" onError={() => setFailed(true)} />}
      </div>
      <div className="staff-card__body">
        <span className="staff-card__role">{role}</span>
        {name && <span className="staff-card__name">{name}</span>}
        <span className="staff-card__duty">{member.duty[lang]}</span>
      </div>
    </article>
  );
}

function SectionHead({ eyebrow, title, lead, align = 'center' }) {
  return (
    <header className={`section-head section-head--${align}`}>
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
        {/* ---- Hero: rotating campus photos under a dark overlay --------- */}
        <section id="mwanzo" className="hero" aria-label={t.nav.home}>
          <HeroBackground lang={lang} />
          <div className="hero__overlay" aria-hidden="true" />
          <div className="site-container hero__inner">
            <span className="hero__eyebrow"><ShieldCheck size={15} aria-hidden="true" /> {t.registered}</span>
            <h1 className="hero__title">{school?.name || t.hero.eyebrow}</h1>
            <p className="hero__subtitle">{t.hero.eyebrow}</p>
            <p className="hero__intro">{t.hero.intro}</p>
            <div className="hero__actions">
              {portalLink('site-btn site-btn--accent site-btn--lg', t.hero.primary)}
              <a href="#kuhusu" className="site-btn site-btn--ghost site-btn--lg">{t.hero.secondary} <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
            <ul className="hero__highlights">
              {t.hero.highlights.map((item) => <li key={item}><CheckCircle2 size={16} aria-hidden="true" /> {item}</li>)}
            </ul>
          </div>
        </section>

        {/* ---- School overview ------------------------------------------- */}
        <section id="kuhusu" className="site-section">
          <div className="site-container overview">
            <figure className="overview__media">
              <img src={IMAGES.overview} alt={t.overview.imageAlt} loading="lazy" />
            </figure>
            <div className="overview__copy">
              <SectionHead eyebrow={t.overview.eyebrow} title={t.overview.title} lead={t.overview.lead} align="start" />
              <div className="overview__cards">
                <article className="info-tile">
                  <span className="info-tile__icon" aria-hidden="true"><Telescope size={18} /></span>
                  <div>
                    <h3>{t.overview.vision}</h3>
                    <p>{school?.vision || t.overview.defaultVision}</p>
                  </div>
                </article>
                <article className="info-tile">
                  <span className="info-tile__icon" aria-hidden="true"><Target size={18} /></span>
                  <div>
                    <h3>{t.overview.mission}</h3>
                    <p>{school?.mission || t.overview.defaultMission}</p>
                  </div>
                </article>
              </div>
              <div className="overview__values">
                <span>{t.overview.valuesLabel}:</span>
                {t.overview.values.map((value) => <span key={value} className="tag">{value}</span>)}
              </div>
            </div>
          </div>
        </section>

        {/* ---- Academic streams ------------------------------------------ */}
        <section id="michepuo" className="site-section site-section--tinted">
          <div className="site-container">
            <SectionHead eyebrow={t.streams.eyebrow} title={t.streams.title} lead={t.streams.lead} />
            <h3 className="streams__label">{t.streams.oLevel}</h3>
            <div className="stream-grid">
              {t.streams.oStreams.map((stream) => (
                <article key={stream.code} className="stream-card">
                  <span className="stream-card__code mono">{stream.code}</span>
                  <h4 className="stream-card__title">{stream.title}</h4>
                  <p>{stream.subjects}</p>
                </article>
              ))}
            </div>
            <h3 className="streams__label">{t.streams.aLevel}</h3>
            <div className="combo-grid">
              {t.streams.combinations.map((combo) => (
                <div key={combo.code} className="combo">
                  <span className="combo__code mono">{combo.code}</span>
                  <span className="combo__title">{combo.title}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Administrative structure ---------------------------------- */}
        <section id="uongozi" className="site-section">
          <div className="site-container">
            <SectionHead eyebrow={t.administration.eyebrow} title={t.administration.title} lead={t.administration.lead} />
            <div className="admin-banner" style={{ '--banner-image': `url("${IMAGES.administration}")` }}>
              <p>{t.administration.banner}</p>
            </div>
            <div className="staff-grid">
              {STAFF.map((member) => (
                <StaffCard key={member.id} member={member} lang={lang} name={member.nameFrom ? school?.[member.nameFrom] : null} />
              ))}
            </div>
          </div>
        </section>

        {/* ---- Parent portal --------------------------------------------- */}
        <section id="wazazi" className="site-section site-section--tinted">
          <div className="site-container parents">
            <div className="parents__copy">
              <SectionHead eyebrow={t.parents.eyebrow} title={t.parents.title} lead={t.parents.lead} align="start" />
              <ul className="parents__list">
                {t.parents.items.map((item) => {
                  const Icon = PARENT_ICONS[item.key];
                  return (
                    <li key={item.key}>
                      <span className="parents__icon" aria-hidden="true"><Icon size={18} /></span>
                      <span><strong>{item.title}</strong><span>{item.text}</span></span>
                    </li>
                  );
                })}
              </ul>
              {portalLink('site-btn site-btn--primary site-btn--lg', t.parents.action)}
            </div>
            <figure className="parents__media">
              <img src={IMAGES.parents} alt={t.parents.imageAlt} loading="lazy" />
            </figure>
          </div>
        </section>

        {/* ---- Announcements --------------------------------------------- */}
        <section id="matangazo" className="site-section">
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

        {/* ---- Call to action (photo with dark overlay) ------------------- */}
        <section className="cta" style={{ '--cta-image': `url("${IMAGES.cta}")` }}>
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
              {SECTIONS.map((section) => <li key={section.id}><a href={`#${section.id}`}>{t.nav[section.key]}</a></li>)}
            </ul>
          </div>
          <div>
            <h3 className="site-footer__heading">{t.footer.portal}</h3>
            <p className="site-footer__note">{t.cta.text}</p>
            {portalLink('site-btn site-btn--accent')}
          </div>
        </div>
        <div className="site-footer__bar">
          <div className="site-container">© <span className="mono">{new Date().getFullYear()}</span> {school?.name}. {t.footer.rights}</div>
        </div>
      </footer>
    </div>
  );
}
