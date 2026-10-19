import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader.jsx';
import PhotoPicker from '../components/ui/PhotoPicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatDateTime, formatPhone } from '../utils/format.js';

/** /account — every role manages its own profile picture and sees its account details. */
export default function AccountProfile() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, updatePhoto } = useAuth();
  const [saving, setSaving] = useState(false);

  const handlePhoto = async (dataUrl) => {
    setSaving(true);
    try {
      await updatePhoto(dataUrl);
      toast.success(dataUrl ? t('account.photoSaved') : t('account.photoRemoved'));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack-lg">
      <PageHeader eyebrow={t('nav.sections.account')} title={t('account.title')} subtitle={t('account.subtitle')} />
      <div className="account-layout">
        <section className="card">
          <div className="card__header"><h2 className="card__title">{t('account.photo')}</h2></div>
          <div className="card__body">
            <PhotoPicker
              name={user.fullName}
              value={undefined}
              currentUrl={user.photoUrl}
              onChange={handlePhoto}
              removable={Boolean(user.photoUrl)}
              disabled={saving}
              hint={t('account.photoHint')}
            />
          </div>
        </section>
        <section className="card">
          <div className="card__header"><h2 className="card__title">{t('account.details')}</h2></div>
          <dl className="definition-list card__body">
            <dt>{t('account.name')}</dt><dd>{user.fullName}</dd>
            <dt>{t('account.role')}</dt><dd>{t(`roles.${user.role}`)}</dd>
            <dt>{t('account.email')}</dt><dd>{user.email || '—'}</dd>
            <dt>{t('account.phone')}</dt><dd className="mono">{user.phone ? formatPhone(user.phone) : '—'}</dd>
            <dt>{t('account.lastLogin')}</dt><dd className="mono">{formatDateTime(user.lastLoginAt)}</dd>
          </dl>
          <div className="card__footer">
            <Link to="/account/password" className="btn btn--outline"><KeyRound size={16} aria-hidden="true" /> {t('nav.items.password')}</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
