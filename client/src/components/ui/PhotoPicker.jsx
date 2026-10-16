import { Camera, Trash2, Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '../../api/client.js';
import { resizeImageFile } from '../../utils/images.js';

/**
 * Passport-photo picker. `value` is a pending data URL (new pick), `currentUrl` the saved photo
 * (API-relative). `onChange(dataUrl | null)` reports a new pick or a removal request.
 */
export default function PhotoPicker({ name, value, currentUrl, onChange, removable = false, disabled = false }) {
  const { t } = useTranslation();
  const inputId = useId();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const preview = value || (value === null ? null : currentUrl ? apiUrl(currentUrl) : null);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await resizeImageFile(file));
    } catch {
      setError(t('students.photo.invalid'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="photo-picker">
      <div className="photo-picker__frame">
        {preview
          ? <img src={preview} alt={t('students.photo.alt', { name: name || '' })} />
          : <Camera size={30} aria-hidden="true" />}
      </div>
      <div className="photo-picker__actions">
        <label htmlFor={inputId} className={`btn btn--outline btn--sm${disabled || busy ? ' is-disabled' : ''}`}>
          <Upload size={14} aria-hidden="true" /> {preview ? t('students.photo.change') : t('students.photo.upload')}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          onChange={handleFile}
          disabled={disabled || busy}
        />
        {removable && preview && (
          <button type="button" className="btn btn--ghost btn--sm text-danger" onClick={() => onChange(null)} disabled={disabled || busy}>
            <Trash2 size={14} aria-hidden="true" /> {t('common.remove')}
          </button>
        )}
      </div>
      <span className={error ? 'form-error' : 'form-hint'}>{error || t('students.photo.hint')}</span>
    </div>
  );
}
