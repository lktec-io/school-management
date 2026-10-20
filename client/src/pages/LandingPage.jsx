import {
  ArrowRight, Award, BellRing, CheckCircle2, ExternalLink, FileText, FlaskConical, LayoutDashboard, LogIn, Mail,
  MapPin, Megaphone, Menu, Microscope, Monitor, Phone, Receipt, ShieldCheck, Target, Telescope, Wallet, X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Crest from '../components/layout/Crest.jsx';
import InstagramIcon from '../components/ui/InstagramIcon.jsx';
import LanguageSwitch from '../components/ui/LanguageSwitch.jsx';
import LiveBadge from '../components/ui/LiveBadge.jsx';
import { COPY, IMAGES, INSTAGRAM_REELS, SLIDES, STAFF, TOURS } from '../content/landing.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useSchoolProfile } from '../hooks/useSchoolProfile.js';
import { isFreshNews } from '../utils/news.js';
import '../styles/landing.css';

const SECTIONS = [
  { id: 'kuhusu', key: 'overview' },
  { id: 'ngazi', key: 'levels' },
  { id: 'mafanikio', key: 'achievements' },
  { id: 'video', key: 'media' },
  { id: 'uongozi', key: 'administration' },
  { id: 'matangazo', key: 'announcements' },
];
const PARENT_ICONS = { reports: FileText, fees: Wallet, receipts: Receipt, sms: BellRing };
const FACILITY_IMAGES = { science: IMAGES.scienceLab, practical: IMAGES.practical, computer: IMAGES.computer };
const FACILITY_ICONS = { science: Microscope, practical: FlaskConical, computer: Monitor };
const SLIDE_MS = 6500;

function initialsOf(text = '') {
  return text.replace(/\b(Mhe|Dkt|Dr|Prof|Mwl|Mr|Mrs|Ms|Bw|Bi)\.\s*/g, '').split(/\s+/).filter((part) => /^[A-Za-z]/.test(part))
    .slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '—';
}

/** "+255 776 119 799 / +255 65 649 9288" → [{ label, tel }] for each number. */
function phoneList(value) {
  return String(value || '').split(/[/|,;]/).map((part) => part.trim()).filter(Boolean)
    .map((label) => ({ label, tel: label.replace(/[^\d+]/g, '') }));
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

function StaffCard({ member, name, lang, index }) {
  const [failed, setFailed] = useState(false);
  const role = member.role[lang];
  return (
    <article className="staff-card reveal" style={delay(index)}>
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

function SectionHead({ eyebrow, title, lead, align = 'center', badge }) {
  return (
    <header className={`section-head section-head--${align} reveal`}>
      <span className="section-head__eyebrow">{eyebrow}{badge}</span>
      <h2 className="section-head__title">{title}</h2>
      {lead && <p className="section-head__lead">{lead}</p>}
    </header>
  );
}

/** Stagger delay for the n-th item of a revealed group (capped so long lists do not lag). */
const delay = (index) => ({ '--reveal-delay': `${Math.min(index, 6) * 80}ms` });

/**
 * Scroll-triggered fade-in-up for every .reveal element inside `rootRef`. Uses only opacity and
 * transform (GPU-composited, no layout shift). Content stays visible when IntersectionObserver is
 * unavailable or the visitor prefers reduced motion — the page never depends on this to show text.
 */
function useScrollReveal(rootRef, refreshKey) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    root.classList.add('reveal-ready');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    root.querySelectorAll('.reveal:not(.is-visible)').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [rootRef, refreshKey]);
}

/** Instagram reel embed (Instagram's own player; it does not allow autoplay from other sites). */
function ReelEmbed({ code, title, label, watch, index }) {
  return (
    <figure className="reel reveal" style={delay(index)}>
      <div className="reel__frame">
        <iframe
          src={`https://www.instagram.com/reel/${code}/embed/`}
          title={`${title} ${index + 1}`}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <figcaption className="reel__caption">
        <span>{label} <span className="mono">{index + 1}</span></span>
        <a href={`https://www.instagram.com/reel/${code}/`} target="_blank" rel="noopener noreferrer">
          <InstagramIcon size={14} aria-hidden="true" /> {watch}
        </a>
      </figcaption>
    </figure>
  );
}

/** Trifonia Academy public website. Every sign-in action goes to the dedicated /login page. */
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
  const phones = phoneList(school?.phone);
  const reels = school?.instagramReels?.length ? school.instagramReels : INSTAGRAM_REELS;
  const siteRef = useRef(null);
  useScrollReveal(siteRef, `${announcements.data?.length ?? 0}-${reels.join()}`);

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
    <div className="site" ref={siteRef}>
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
          <HeroBackground lang={lang} />
          <div className="hero__overlay" aria-hidden="true" />
          <div className="site-container hero__inner hero__inner--animated">
            <span className="hero__eyebrow">
              <ShieldCheck size={15} aria-hidden="true" /> {t.registered}
              {school?.registrationNo && <> · {t.registration} <span className="mono">{school.registrationNo}</span></>}
            </span>
            <h1 className="hero__title">{school?.name || t.hero.eyebrow}</h1>
            {school?.motto && <p className="hero__motto">“{school.motto}”</p>}
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

        {/* ---- Admissions 2027 strip ------------------------------------- */}
        <section className="admissions" aria-label={t.admissions.badge}>
          <div className="site-container admissions__inner reveal">
            <LiveBadge>{t.admissions.badge}</LiveBadge>
            <p className="admissions__text">{t.admissions.text}</p>
            <div className="admissions__calls">
              {phones.map((phone) => (
                <a key={phone.tel} href={`tel:${phone.tel}`} className="site-btn site-btn--outline-light">
                  <Phone size={15} aria-hidden="true" /> <span className="mono">{phone.label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ---- School overview ------------------------------------------- */}
        <section id="kuhusu" className="site-section">
          <div className="site-container overview">
            <figure className="overview__media reveal">
              <img src={IMAGES.overview} alt={t.overview.imageAlt} loading="lazy" />
            </figure>
            <div className="overview__copy">
              <SectionHead eyebrow={t.overview.eyebrow} title={t.overview.title} lead={t.overview.lead} align="start" />
              <div className="overview__cards">
                <article className="info-tile reveal" style={delay(1)}>
                  <span className="info-tile__icon" aria-hidden="true"><Telescope size={18} /></span>
                  <div>
                    <h3>{t.overview.vision}</h3>
                    <p>{school?.vision || t.overview.defaultVision}</p>
                  </div>
                </article>
                <article className="info-tile reveal" style={delay(2)}>
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

        {/* ---- Levels: Nursery, Primary, Secondary ------------------------ */}
        <section id="ngazi" className="site-section site-section--tinted">
          <div className="site-container">
            <SectionHead eyebrow={t.levels.eyebrow} title={t.levels.title} lead={t.levels.lead} />
            <div className="stream-grid">
              {t.levels.items.map((level, index) => (
                <article key={level.code} className="stream-card reveal" style={delay(index)}>
                  <span className="stream-card__code mono">{level.code}</span>
                  <h3 className="stream-card__title">{level.title}</h3>
                  <p>{level.text}</p>
                </article>
              ))}
            </div>
            <h3 className="streams__label">{t.levels.streamsLabel}</h3>
            <div className="combo-grid">
              {t.levels.streams.map((stream, index) => (
                <div key={stream.code} className="combo reveal" style={delay(index)}>
                  <span className="combo__code mono">{stream.title}</span>
                  <span className="combo__title">{stream.subjects}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Achievements + educational tours --------------------------- */}
        <section id="mafanikio" className="site-section achievements">
          <div className="site-container">
            <SectionHead eyebrow={t.achievements.eyebrow} title={t.achievements.title} />
            <div className="stat-band">
              {t.achievements.stats.map((stat, index) => (
                <div key={stat.value} className="stat-band__item reveal" style={delay(index)}>
                  <Award size={22} aria-hidden="true" />
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
            <div className="tours">
              <div className="tours__head reveal">
                <h3>{t.achievements.toursTitle}</h3>
                <p>{t.achievements.toursLead}</p>
              </div>
              <div className="tour-grid">
                {TOURS.map((tour, index) => (
                  <figure key={tour.id} className="tour-card reveal" style={delay(index)}>
                    <img src={tour.image} alt={tour.name} loading="lazy" />
                    <figcaption>
                      <strong>{tour.name}</strong>
                      <span>{tour.note[lang]}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---- Facilities: science labs, computers ------------------------ */}
        <section className="site-section site-section--tinted">
          <div className="site-container">
            <SectionHead eyebrow={t.facilities.eyebrow} title={t.facilities.title} />
            <div className="facility-grid">
              {t.facilities.items.map((item, index) => {
                const Icon = FACILITY_ICONS[item.key];
                return (
                  <article key={item.key} className="facility-card reveal" style={delay(index)}>
                    <img src={FACILITY_IMAGES[item.key]} alt={item.title} loading="lazy" />
                    <div className="facility-card__body">
                      <span className="facility-card__icon" aria-hidden="true"><Icon size={18} /></span>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---- Instagram reels ------------------------------------------- */}
        <section id="video" className="site-section media">
          <div className="site-container">
            <SectionHead eyebrow={t.media.eyebrow} title={t.media.title} lead={t.media.lead} />
            <div className={`media__reels media__reels--${Math.min(reels.length, 3)}`}>
              {reels.slice(0, 3).map((code, index) => (
                <ReelEmbed key={code} code={code} index={index} title={t.media.frameTitle} label={t.media.reel} watch={t.media.watch} />
              ))}
            </div>
            <div className="media__actions reveal">
              {school?.instagramUrl && (
                <a href={school.instagramUrl} className="site-btn site-btn--instagram" target="_blank" rel="noopener noreferrer">
                  <InstagramIcon size={17} aria-hidden="true" /> {t.media.follow}
                </a>
              )}
              <a href={`https://www.instagram.com/reel/${reels[0]}/`} className="site-btn site-btn--outline" target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" /> {t.media.open}
              </a>
            </div>
          </div>
        </section>

        {/* ---- Administrative structure ---------------------------------- */}
        <section id="uongozi" className="site-section site-section--tinted">
          <div className="site-container">
            <SectionHead eyebrow={t.administration.eyebrow} title={t.administration.title} lead={t.administration.lead} />
            <div className="admin-banner reveal" style={{ '--banner-image': `url("${IMAGES.administration}")` }}>
              <p>{t.administration.banner}</p>
            </div>
            <div className="staff-grid">
              {STAFF.map((member, index) => (
                <StaffCard key={member.id} member={member} lang={lang} index={index} name={member.nameFrom ? school?.[member.nameFrom] : null} />
              ))}
            </div>
          </div>
        </section>

        {/* ---- Parent portal --------------------------------------------- */}
        <section id="wazazi" className="site-section">
          <div className="site-container parents">
            <div className="parents__copy">
              <SectionHead eyebrow={t.parents.eyebrow} title={t.parents.title} lead={t.parents.lead} align="start" />
              <ul className="parents__list">
                {t.parents.items.map((item, index) => {
                  const Icon = PARENT_ICONS[item.key];
                  return (
                    <li key={item.key} className="reveal" style={delay(index)}>
                      <span className="parents__icon" aria-hidden="true"><Icon size={18} /></span>
                      <span><strong>{item.title}</strong><span>{item.text}</span></span>
                    </li>
                  );
                })}
              </ul>
              {portalLink('site-btn site-btn--primary site-btn--lg', t.parents.action)}
            </div>
            <figure className="parents__media reveal">
              <img src={IMAGES.parents} alt={t.parents.imageAlt} loading="lazy" />
            </figure>
          </div>
        </section>

        {/* ---- Announcements --------------------------------------------- */}
        <section id="matangazo" className="site-section site-section--tinted">
          <div className="site-container">
            <SectionHead
              eyebrow={t.announcements.eyebrow}
              title={t.announcements.title}
              badge={(announcements.data ?? []).some((item) => isFreshNews(item.publishedAt)) ? <LiveBadge>{t.announcements.live}</LiveBadge> : null}
            />
            {announcements.error && <p className="notice-empty">{t.announcements.error}</p>}
            {announcements.data && announcements.data.length === 0 && (
              <p className="notice-empty"><Megaphone size={18} aria-hidden="true" /> {t.announcements.empty}</p>
            )}
            {announcements.data && announcements.data.length > 0 && (
              <div className="notice-grid">
                {announcements.data.map((item, index) => {
                  const date = new Date(`${item.publishedAt}T12:00:00`);
                  return (
                    <article key={item.id} className={`notice reveal${isFreshNews(item.publishedAt) ? ' notice--fresh' : ''}`} style={delay(index)}>
                      <div className="notice__meta">
                        <span className="notice__category">{t.announcements.categories[item.category] ?? item.category}</span>
                        {isFreshNews(item.publishedAt) && <LiveBadge className="live-badge--sm">{t.announcements.new}</LiveBadge>}
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
          <div className="site-container cta__inner reveal">
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
          <div className="site-footer__brand reveal">
            <Crest name={school?.name || ''} size={48} inverted logoSrc={school?.logoSrc} />
            <div>
              <strong>{school?.name}</strong>
              {school?.motto && <span>“{school.motto}”</span>}
              {school?.registrationNo && <span>{t.registration}: <span className="mono">{school.registrationNo}</span></span>}
            </div>
          </div>
          <div className="reveal" style={delay(1)}>
            <h3 className="site-footer__heading">{t.footer.contact}</h3>
            <ul className="site-footer__list">
              {school?.address && <li><MapPin size={15} aria-hidden="true" /> {school.address}</li>}
              {phones.map((phone) => (
                <li key={phone.tel}><Phone size={15} aria-hidden="true" /> <a className="mono" href={`tel:${phone.tel}`}>{phone.label}</a></li>
              ))}
              {school?.email && <li><Mail size={15} aria-hidden="true" /> <a href={`mailto:${school.email}`}>{school.email}</a></li>}
              {school?.instagramUrl && (
                <li><InstagramIcon size={15} aria-hidden="true" /> <a href={school.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram</a></li>
              )}
              {school?.website && <li><ExternalLink size={15} aria-hidden="true" /> <a href={school.website} rel="noopener noreferrer">{school.website.replace(/^https?:\/\//, '')}</a></li>}
            </ul>
          </div>
          <div className="reveal" style={delay(2)}>
            <h3 className="site-footer__heading">{t.footer.quickLinks}</h3>
            <ul className="site-footer__list">
              {SECTIONS.map((section) => <li key={section.id}><a href={`#${section.id}`}>{t.nav[section.key]}</a></li>)}
            </ul>
          </div>
          <div className="reveal" style={delay(3)}>
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
