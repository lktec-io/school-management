import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.js';
import sw from './locales/sw.js';

/** Shared with the public website so the language chosen there carries into the portal. */
export const LANG_KEY = 'school-site-lang';
export const LANGUAGES = [
  { code: 'sw', short: 'SW', name: 'Kiswahili' },
  { code: 'en', short: 'EN', name: 'English' },
];

function savedLanguage() {
  try {
    return window.localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'sw';
  } catch {
    return 'sw';
  }
}

function applyLanguage(lng) {
  document.documentElement.lang = lng;
  try {
    window.localStorage.setItem(LANG_KEY, lng);
  } catch {
    // Storage may be unavailable (private mode); the choice still applies for this visit.
  }
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, sw: { translation: sw } },
  lng: savedLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['sw', 'en'],
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyLanguage(i18n.language);
i18n.on('languageChanged', applyLanguage);

/** BCP-47 locale for Intl formatting of dates in the active language. */
export function dateLocale() {
  return i18n.language === 'sw' ? 'sw-TZ' : 'en-GB';
}

export default i18n;
