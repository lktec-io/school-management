import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n/index.js';

/** SW | EN segmented toggle; the choice is saved and shared with the public website. */
export default function LanguageSwitch({ className = '', showIcon = false }) {
  const { t, i18n } = useTranslation();
  return (
    <div className={`lang-toggle ${className}`} role="group" aria-label={t('topbar.language')}>
      {showIcon && <Languages size={15} aria-hidden="true" className="lang-toggle__icon" />}
      {LANGUAGES.map((language) => (
        <button
          key={language.code}
          type="button"
          lang={language.code}
          title={language.name}
          aria-pressed={i18n.resolvedLanguage === language.code}
          onClick={() => i18n.changeLanguage(language.code)}
        >
          {language.short}
        </button>
      ))}
    </div>
  );
}
