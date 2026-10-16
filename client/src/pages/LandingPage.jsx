import {
  BellRing, BookOpenCheck, ChevronDown, ExternalLink, FileText, GraduationCap, LayoutDashboard, LogIn, Mail, Menu, MessageSquareText,
  MapPin, Megaphone, Phone, Receipt, ShieldCheck, Target, Telescope, UsersRound, X,
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
import '../styles/gov.css';
import '../styles/landing.css';

const SECTIONS = [
  { id: 'mwanzo', key: 'home' },
  { id: 'kuhusu', key: 'about' },
  { id: 'masomo', key: 'academics' },
  { id: 'matangazo', key: 'announcements' },
  { id: 'huduma', key: 'services' },
];
const SERVICE_ICONS = { results: FileText, fees: Receipt, sms: MessageSquareText, staff: LayoutDashboard };

function initialsOf(name = '') {
  return name.replace(/\b(Mhe|Dkt|Dr|Prof|Mwl|H\.E)\.\s*/g, '').split(/\s+/).filter((part) => /^[A-Za-z]/.test(part))
    .slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '—';
}

function LeaderCard({ leader, name, title }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="leader-card">
      <div className="leader-card__photo">
        {failed ? (
          <span className="leader-card__initials" aria-hidden="true">{initialsOf(name)}</span>
        ) : (
          <img src={leader.photo} alt={name} loading="lazy" onError={() => setFailed(true)} />
        )}
      </div>
      <figcaption className="leader-card__badge">
        <span className="leader-card__name">{name}</span>
        <span className="leader-card__title">{title}</span>
      </figcaption>
    </figure>
  );
}

function InfoCard({ icon: Icon, title, summary, children, labels, accent }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`info-card${accent ? ' info-card--accent' : ''}${open ? ' is-open' : ''}`}>
      <div className="info-card__icon" aria-hidden="true"><Icon size={22} /></div>
      <h3 className="info-card__title">{title}</h3>
      <div className="info-card__summary">{summary}</div>
      {children && (
        <>
          <div className="info-card__details" hidden={!open}>{children}</div>
          <button type="button" className="info-card__toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? labels.readLess : labels.readMore}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </>
      )}
    </article>
  );
}

/** Public website of the school, styled after official government portals. */
export default function LandingPage() {
  const { status } = useAuth();
  const school = useSchoolProfile();
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'sw';
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('mwanzo');
  const announcements = useApi('/announcements', { limit: 6 });
  const t = COPY[lang];
  const authenticated = status === 'authenticated';

  useEffect(() => {
    if (school?.name) document.title = school.name;
  }, [school?.name]);

  // Highlight the navigation link of the section currently in view.
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.25, 0.5] });
    SECTIONS.forEach(({ id }) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  const headmasterName = school?.headmasterName;
  const year = new Date().getFullYear();

  const portalButton = authenticated ? (
    <Link to="/dashboard" className="gov-btn gov-btn--gold">
      <LayoutDashboard size={16} aria-hidden="true" /> {t.nav.openPortal}
    </Link>
  ) : (
    <Link to="/login" className="gov-btn gov-btn--gold">
      <LogIn size={16} aria-hidden="true" /> {t.nav.login}
    </Link>
  );

  return (
    <div className="site">
      <a href="#yaliyomo" className="skip-link">Skip to content</a>

      {/* ---- Utility bar ------------------------------------------------ */}
      <div className="utility-bar">
        <div className="site-container utility-bar__inner">
          <div className="utility-bar__identity">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>{t.utility.registered}</span>
            {school?.registrationNo && (
              <span className="utility-bar__reg">{t.utility.registration}: <span className="mono">{school.registrationNo}</span></span>
            )}
          </div>
          <div className="utility-bar__contacts">
            {school?.phone && (
              <a href={`tel:${school.phone.replace(/[^\d+]/g, '')}`}><Phone size={13} aria-hidden="true" /><span className="mono">{formatPhone(school.phone)}</span></a>
            )}
            {school?.email && <a href={`mailto:${school.email}`}><Mail size={13} aria-hidden="true" />{school.email}</a>}
          </div>
          <nav className="utility-bar__links" aria-label="Utility">
            <Link to={authenticated ? '/reports' : '/login'} state={authenticated ? undefined : { from: { pathname: '/reports' } }}>{t.utility.results}</Link>
            <Link to={authenticated ? '/dashboard' : '/login'}>{t.utility.fees}</Link>
            <a href="#mawasiliano">{t.utility.contact}</a>
            <LanguageSwitch className="lang-switch" />
          </nav>
        </div>
      </div>

      {/* ---- Masthead ---------------------------------------------------- */}
      <header className="masthead">
        <div className="site-container masthead__inner">
          <Crest name={school?.name || ''} size={64} logoSrc={school?.logoSrc} />
          <div className="masthead__text">
            <span className="masthead__eyebrow">{t.utility.registered}</span>
            <span className="masthead__name">{school?.name || ' '}</span>
            {school?.motto && <span className="masthead__motto">“{school.motto}”</span>}
          </div>
          <div className="masthead__seal" aria-hidden="true">
            <span>ZANZIBAR</span>
          </div>
        </div>
      </header>

      {/* ---- Main navigation -------------------------------------------- */}
      <nav className="main-nav" aria-label="Main">
        <div className="site-container main-nav__inner">
          <button type="button" className="main-nav__toggle" aria-expanded={menuOpen} aria-controls="main-nav-links" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />} {t.nav.menu}
          </button>
          <ul id="main-nav-links" className={`main-nav__links${menuOpen ? ' is-open' : ''}`}>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={activeSection === section.id ? 'is-active' : undefined}
                  aria-current={activeSection === section.id ? 'location' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {t.nav[section.key]}
                </a>
              </li>
            ))}
          </ul>
          <div className="main-nav__cta">{portalButton}</div>
        </div>
      </nav>

      <main id="yaliyomo">
        {/* ---- Hero: leadership + slideshow ------------------------------ */}
        <section id="mwanzo" className="hero site-container" aria-label={t.nav.home}>
          <aside className="leadership" aria-label={t.leadership}>
            <h2 className="leadership__heading">{t.leadership}</h2>
            <div className="leadership__list">
              {LEADERS.map((leader) => (
                <LeaderCard
                  key={leader.id}
                  leader={leader}
                  name={leader.name ?? headmasterName ?? leader.title[lang]}
                  title={leader.title[lang]}
                />
              ))}
            </div>
          </aside>
          <HeroSlideshow
            slides={SLIDES}
            lang={lang}
            labels={{ ...t.slideshow, region: school?.name || t.nav.home, dots: t.slideshow.goTo }}
          />
        </section>

        {/* ---- About: vision, mission, values, standards ----------------- */}
        <section id="kuhusu" className="site-section">
          <div className="site-container">
            <header className="section-head">
              <span className="section-head__eyebrow">{t.about.eyebrow}</span>
              <h2 className="section-head__title">{t.about.title}</h2>
              <p className="section-head__lead">{t.about.lead}</p>
            </header>
            <div className="info-grid">
              <InfoCard icon={Telescope} title={t.about.vision} labels={t.about} accent
                summary={<p>{school?.vision || t.about.defaultVision}</p>} />
              <InfoCard icon={Target} title={t.about.mission} labels={t.about}
                summary={<p>{school?.mission || t.about.defaultMission}</p>} />
              <InfoCard icon={UsersRound} title={t.about.values} labels={t.about}
                summary={<p>{t.about.valueList.map((value) => value.title).join(' · ')}</p>}>
                <ul className="info-card__list">
                  {t.about.valueList.map((value) => <li key={value.title}><strong>{value.title}</strong> — {value.text}</li>)}
                </ul>
              </InfoCard>
              <InfoCard icon={ShieldCheck} title={t.about.standards} labels={t.about}
                summary={<p>{t.about.standardList[0]}</p>}>
                <ul className="info-card__list">
                  {t.about.standardList.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </InfoCard>
            </div>
          </div>
        </section>

        {/* ---- Academics ------------------------------------------------- */}
        <section id="masomo" className="site-section site-section--tinted">
          <div className="site-container">
            <header className="section-head">
              <span className="section-head__eyebrow">{t.academics.eyebrow}</span>
              <h2 className="section-head__title">{t.academics.title}</h2>
              <p className="section-head__lead">{t.academics.lead}</p>
            </header>
            <div className="level-grid">
              {t.academics.levels.map((level, levelIndex) => (
                <article key={level.code} className="level-card">
                  <span className="level-card__index mono">{String(levelIndex + 1).padStart(2, '0')}</span>
                  <span className="level-card__code mono">{level.code}</span>
                  <h3 className="level-card__title">{level.title}</h3>
                  <p>{level.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Announcements --------------------------------------------- */}
        <section id="matangazo" className="site-section">
          <div className="site-container">
            <header className="section-head">
              <span className="section-head__eyebrow">{t.announcements.eyebrow}</span>
              <h2 className="section-head__title">{t.announcements.title}</h2>
            </header>
            {announcements.error && <p className="notice-empty">{t.announcements.error}</p>}
            {announcements.data && announcements.data.length === 0 && (
              <p className="notice-empty"><Megaphone size={18} aria-hidden="true" /> {t.announcements.empty}</p>
            )}
            {announcements.data && announcements.data.length > 0 && (
              <div className="notice-list">
                {announcements.data.map((item) => {
                  const date = new Date(`${item.publishedAt}T12:00:00`);
                  return (
                    <article key={item.id} className="notice">
                      <time className="notice__date" dateTime={item.publishedAt}>
                        <span className="notice__day mono">{String(date.getDate()).padStart(2, '0')}</span>
                        <span className="notice__month">{date.toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', { month: 'short', year: 'numeric' })}</span>
                      </time>
                      <div className="notice__body">
                        <span className="notice__category">{t.announcements.categories[item.category] ?? item.category}</span>
                        <h3 className="notice__title">{item.title}</h3>
                        <p className="notice__text">{item.body}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ---- Digital services ------------------------------------------ */}
        <section id="huduma" className="site-section site-section--navy">
          <div className="site-container">
            <header className="section-head section-head--inverse">
              <span className="section-head__eyebrow">{t.services.eyebrow}</span>
              <h2 className="section-head__title">{t.services.title}</h2>
              <p className="section-head__lead">{t.services.lead}</p>
            </header>
            <div className="service-grid">
              {t.services.items.map((service) => {
                const Icon = SERVICE_ICONS[service.key] ?? BookOpenCheck;
                return (
                  <article key={service.key} className="service-card">
                    <Icon size={26} aria-hidden="true" />
                    <h3 className="service-card__title">{service.title}</h3>
                    <p>{service.text}</p>
                    {authenticated ? (
                      <Link to="/dashboard" className="service-card__action">{t.nav.openPortal} <ExternalLink size={13} aria-hidden="true" /></Link>
                    ) : (
                      <Link to="/login" className="service-card__action">{t.services.action} <LogIn size={13} aria-hidden="true" /></Link>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* ---- Footer ------------------------------------------------------ */}
      <footer id="mawasiliano" className="site-footer">
        <div className="site-container site-footer__grid">
          <div className="site-footer__brand">
            <Crest name={school?.name || ''} size={52} inverted logoSrc={school?.logoSrc} />
            <div>
              <strong>{school?.name}</strong>
              {school?.motto && <span>“{school.motto}”</span>}
            </div>
          </div>
          <div>
            <h3 className="site-footer__heading">{t.footer.contact}</h3>
            <ul className="site-footer__list">
              {school?.address && <li><MapPin size={14} aria-hidden="true" /> {school.address}</li>}
              {school?.phone && <li><Phone size={14} aria-hidden="true" /> <span className="mono">{formatPhone(school.phone)}</span></li>}
              {school?.email && <li><Mail size={14} aria-hidden="true" /> <a href={`mailto:${school.email}`}>{school.email}</a></li>}
              {school?.website && <li><ExternalLink size={14} aria-hidden="true" /> <a href={school.website} rel="noopener noreferrer">{school.website.replace(/^https?:\/\//, '')}</a></li>}
            </ul>
          </div>
          <div>
            <h3 className="site-footer__heading">{t.footer.quickLinks}</h3>
            <ul className="site-footer__list">
              {SECTIONS.slice(1).map((section) => <li key={section.id}><a href={`#${section.id}`}>{t.nav[section.key]}</a></li>)}
            </ul>
          </div>
          <div>
            <h3 className="site-footer__heading">{t.footer.portal}</h3>
            <ul className="site-footer__list">
              <li><GraduationCap size={14} aria-hidden="true" /> {t.services.items[0].title}</li>
              <li><Receipt size={14} aria-hidden="true" /> {t.services.items[1].title}</li>
              <li><BellRing size={14} aria-hidden="true" /> {t.services.items[2].title}</li>
            </ul>
            {portalButton}
          </div>
        </div>
        <div className="site-footer__bar">
          <div className="site-container">
            © <span className="mono">{year}</span> {school?.name}. {t.footer.rights}
          </div>
        </div>
      </footer>

    </div>
  );
}
