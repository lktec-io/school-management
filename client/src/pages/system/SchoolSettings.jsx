import { ImageUp, Save, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiUrl } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import { ErrorBlock, InlineAlert, PageSkeleton } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useForm } from '../../hooks/useForm.js';
import { refreshSchoolProfile } from '../../hooks/useSchoolProfile.js';
import AnnouncementsCard from './AnnouncementsCard.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';

const ASSETS = [
  { kind: 'logo', label: 'School logo / crest', hint: 'Shown on the portal, report cards and receipts' },
  { kind: 'stamp', label: 'Official stamp', hint: 'Printed on report cards and receipts (transparent PNG works best)' },
  { kind: 'headmaster_signature', label: "Headmaster's signature", hint: 'Printed on report cards' },
  { kind: 'bursar_signature', label: "Bursar's signature", hint: 'Printed on payment receipts' },
];
const MAX_BYTES = 1.5 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The file could not be read'));
    reader.readAsDataURL(file);
  });
}

function ProfileForm({ profile, onSaved }) {
  const toast = useToast();
  const form = useForm({
    name: profile.name ?? '',
    registrationNo: profile.registrationNo ?? '',
    address: profile.address ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    website: profile.website ?? '',
    instagramUrl: profile.instagramUrl ?? '',
    motto: profile.motto ?? '',
    headmasterName: profile.headmasterName ?? '',
    bursarName: profile.bursarName ?? '',
    vision: profile.vision ?? '',
    mission: profile.mission ?? '',
  });
  const { bind, errors, formError, submitting, submit } = form;

  return (
    <form className="card" onSubmit={submit(async (values) => {
      await api.put('/system/settings', values);
      toast.success('School settings saved. New documents will use these details.');
      await refreshSchoolProfile();
      onSaved();
    })} noValidate>
      <div className="card__header"><h2 className="card__title">School identity</h2></div>
      <div className="card__body stack">
        {formError && !Object.values(errors).some(Boolean) && <InlineAlert tone="danger">{formError}</InlineAlert>}
        <p className="text-sm text-muted">Printed on report cards, receipts and SMS messages. Clearing a field restores the server default.</p>
        <div className="form-grid form-grid--2">
          <FormField label="School name" required error={errors.name} className="span-2">
            <input className="form-control" {...bind('name')} />
          </FormField>
          <FormField label="Registration number" error={errors.registrationNo} hint="Zanzibar Ministry of Education registration">
            <input className="form-control mono" {...bind('registrationNo')} />
          </FormField>
          <FormField label="Motto" error={errors.motto}>
            <input className="form-control" {...bind('motto')} />
          </FormField>
          <FormField label="Postal / physical address" error={errors.address} className="span-2">
            <input className="form-control" {...bind('address')} />
          </FormField>
          <FormField label="Phone" error={errors.phone}>
            <input className="form-control mono" {...bind('phone')} />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <input type="email" className="form-control" {...bind('email')} />
          </FormField>
          <FormField label="Website" error={errors.website} className="span-2">
            <input className="form-control" placeholder="https://" {...bind('website')} />
          </FormField>
          <FormField label="Instagram page" error={errors.instagramUrl} className="span-2" hint="e.g. https://www.instagram.com/your_school — shown as “Follow us” on the public website">
            <input className="form-control" placeholder="https://www.instagram.com/" {...bind('instagramUrl')} />
          </FormField>
          <FormField label="Headmaster's name" error={errors.headmasterName} hint="Printed under the signature on report cards">
            <input className="form-control" {...bind('headmasterName')} />
          </FormField>
          <FormField label="Bursar's name" error={errors.bursarName} hint="Printed under the signature on receipts">
            <input className="form-control" {...bind('bursarName')} />
          </FormField>
          <FormField label="Vision (Dira)" error={errors.vision} className="span-2" hint="Shown on the public website">
            <textarea className="form-control" rows={3} maxLength={600} {...bind('vision')} />
          </FormField>
          <FormField label="Mission (Dhamira)" error={errors.mission} className="span-2" hint="Shown on the public website">
            <textarea className="form-control" rows={3} maxLength={600} {...bind('mission')} />
          </FormField>
        </div>
      </div>
      <div className="card__footer form-actions form-actions--flush">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          <Save size={16} aria-hidden="true" /> {submitting ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

function AssetTile({ asset, status, version, onChanged }) {
  const confirm = useConfirm();
  const toast = useToast();
  const inputRef = useRef(null);
  const { run, pending } = useAsyncAction();
  const hasImage = status?.uploaded || status?.fromEnv;

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Choose a PNG or JPEG image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be smaller than 1.5 MB.');
      return;
    }
    const { ok } = await run('upload', async () => {
      const dataUrl = await readAsDataUrl(file);
      await api.put(`/system/branding/${asset.kind}`, { dataUrl });
    }, `${asset.label} uploaded.`);
    if (ok) onChanged();
  };

  return (
    <div className="asset-tile">
      <div className="split-row">
        <strong className="text-sm">{asset.label}</strong>
        {status?.uploaded ? <StatusBadge status="active" label="Uploaded" /> : status?.fromEnv ? <StatusBadge status="info" tone="info" label="From server" /> : <StatusBadge status="none" label="Not set" />}
      </div>
      <div className="asset-tile__preview">
        {hasImage
          ? <img src={apiUrl(`/system/branding/${asset.kind}?v=${version}`)} alt={asset.label} />
          : <span className="text-xs text-muted">No image</span>}
      </div>
      <span className="text-xs text-muted">{asset.hint}</span>
      <div className="asset-tile__actions">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" hidden onChange={upload} />
        <button type="button" className="btn btn--outline btn--sm" onClick={() => inputRef.current?.click()} disabled={pending === 'upload'}>
          {pending === 'upload' ? <span className="spinner" aria-hidden="true" /> : <ImageUp size={14} aria-hidden="true" />} {status?.uploaded ? 'Replace' : 'Upload'}
        </button>
        {status?.uploaded && (
          <button type="button" className="btn btn--ghost btn--sm text-danger" disabled={pending === 'delete'}
            onClick={async () => (await confirm(`Remove the ${asset.label.toLowerCase()}?`))
              && run('delete', () => api.delete(`/system/branding/${asset.kind}`), `${asset.label} removed.`).then(({ ok }) => ok && onChanged())}>
            <Trash2 size={14} aria-hidden="true" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

export default function SchoolSettings() {
  const { t } = useTranslation();
  const { data, error, loading, reload } = useApi('/system/settings');

  return (
    <div className="stack-lg">
      <PageHeader eyebrow={t('nav.sections.administration')} title={t('pages.settings.title')} subtitle={t('pages.settings.subtitle')} />
      {loading && !data && <PageSkeleton />}
      <ErrorBlock error={error} onRetry={reload} />
      {data && (
        <div className="settings-layout">
          <div className="stack">
            <ProfileForm key={JSON.stringify(data.profile)} profile={data.profile} onSaved={reload} />
            <section className="card">
              <div className="card__header"><h2 className="card__title">Branding for documents</h2></div>
              <div className="card__body asset-grid">
                {ASSETS.map((asset) => (
                  <AssetTile
                    key={asset.kind}
                    asset={asset}
                    status={data.assets[asset.kind]}
                    version={data.version}
                    onChanged={() => {
                      reload();
                      refreshSchoolProfile();
                    }}
                  />
                ))}
              </div>
            </section>
          </div>
          <div className="stack">
            <AnnouncementsCard />
          </div>
        </div>
      )}
    </div>
  );
}
