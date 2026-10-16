import { Copy, KeyRound, Pencil, Search, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import FormModal from '../../components/ui/FormModal.jsx';
import { EmptyState, ErrorBlock, InlineAlert, LoadingBlock } from '../../components/ui/Feedback.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useForm } from '../../hooks/useForm.js';
import { ROLE_LABELS, formatDateTime, formatPhone } from '../../utils/format.js';
import { useTranslation } from 'react-i18next';

function UserModal({ user, onClose, onSaved }) {
  const { user: me } = useAuth();
  const isSelf = user?.id === me.id;
  const form = useForm({
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ? formatPhone(user.phone) : '',
    role: user?.role ?? 'teacher',
    status: user?.status ?? 'active',
  });

  return (
    <FormModal
      title={user ? `Edit account — ${user.fullName}` : 'New user account'}
      form={form}
      onClose={onClose}
      submitLabel={user ? 'Save changes' : 'Create account'}
      onSubmit={async (values) => {
        if (user) {
          const payload = { fullName: values.fullName, email: values.email, phone: values.phone };
          if (!isSelf) Object.assign(payload, { role: values.role, status: values.status });
          onSaved({ user: await api.put(`/users/${user.id}`, payload) });
        } else {
          onSaved(await api.post('/users', {
            fullName: values.fullName, email: values.email, phone: values.phone, role: values.role,
          }));
        }
      }}
    >
      <FormField label="Full name" required error={form.errors.fullName}>
        <input className="form-control" {...form.bind('fullName')} />
      </FormField>
      <div className="form-grid form-grid--2">
        <FormField label="Email" error={form.errors.email} hint="Email or phone is required for sign-in">
          <input type="email" className="form-control" autoComplete="off" {...form.bind('email')} />
        </FormField>
        <FormField label="Mobile phone" error={form.errors.phone}>
          <input className="form-control mono" inputMode="tel" placeholder="0777 123 456" {...form.bind('phone')} />
        </FormField>
        <FormField label="Role" required error={form.errors.role} hint={isSelf ? 'You cannot change your own role' : null}>
          <select className="form-control" {...form.bind('role')} disabled={isSelf}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
        {user && (
          <FormField label="Account status" error={form.errors.status} hint={isSelf ? 'You cannot change your own status' : null}>
            <select className="form-control" {...form.bind('status')} disabled={isSelf}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </FormField>
        )}
      </div>
      {!user && (
        <p className="text-sm text-muted">A temporary password is generated and shown once. The user must change it at first sign-in.</p>
      )}
    </FormModal>
  );
}

function TemporaryPasswordModal({ result, onClose }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
      toast.success('Password copied to clipboard.');
    } catch {
      toast.error('Copy failed — please write the password down.');
    }
  };
  return (
    <Modal title="Temporary password" size="sm" onClose={onClose} footer={<button type="button" className="btn btn--primary" onClick={onClose}>Done</button>}>
      <div className="stack">
        <p>Give this password to <strong>{result.user.fullName}</strong> in person or by phone. It will not be shown again.</p>
        <div className="secret-box">
          <code className="mono">{result.temporaryPassword}</code>
          <button type="button" className="btn btn--outline btn--sm" onClick={copy}>
            <Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <InlineAlert tone="info">
          <p>Sign in with <strong className="mono">{result.user.email || formatPhone(result.user.phone)}</strong>. The password must be changed at first sign-in.</p>
        </InlineAlert>
      </div>
    </Modal>
  );
}

export default function UserManagement() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState(() => ({ role: params.get('role') || '', status: '', search: '', page: 1 }));
  const [searchInput, setSearchInput] = useState('');
  const [modal, setModal] = useState(null);
  const { run, pending } = useAsyncAction();

  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim(), page: 1 })), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, error, loading, reload } = useApi('/users', { ...filters, pageSize: 25 });

  const resetPassword = (user) => {
    if (!window.confirm(`Reset the password for ${user.fullName}? They will be signed out everywhere.`)) return;
    run(`reset-${user.id}`, () => api.post(`/users/${user.id}/reset-password`)).then(({ ok, result }) => {
      if (ok) setModal({ type: 'password', result });
    });
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={t('nav.sections.administration')}
        title={t('pages.users.title')}
        subtitle={t('pages.users.subtitle')}
        actions={(
          <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'edit' })}>
            <UserPlus size={16} aria-hidden="true" /> New account
          </button>
        )}
      />

      <div className="filter-bar card">
        <div className="filter-bar__search input-with-icon">
          <Search size={16} aria-hidden="true" />
          <input type="search" className="form-control" placeholder="Search name, email or phone…" aria-label="Search users"
            value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        </div>
        <select className="form-control" aria-label="Filter by role" value={filters.role} onChange={(event) => setFilters((f) => ({ ...f, role: event.target.value, page: 1 }))}>
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="form-control" aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value, page: 1 }))}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <ErrorBlock error={error} onRetry={reload} />

      <section className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Last sign-in</th><th>Status</th>
                <th className="actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && <tr><td colSpan={7}><LoadingBlock /></td></tr>}
              {data?.items.length === 0 && (
                <tr><td colSpan={7}><EmptyState icon={Users} title="No accounts found" /></td></tr>
              )}
              {data?.items.map((user) => (
                <tr key={user.id}>
                  <td>
                    <span className="data-table__primary">{user.fullName}</span>
                    {user.id === me.id && <span className="data-table__secondary">You</span>}
                    {user.mustChangePassword && <span className="data-table__secondary">Temporary password pending</span>}
                  </td>
                  <td>{ROLE_LABELS[user.role]}</td>
                  <td>{user.email || <span className="text-muted">—</span>}</td>
                  <td className="mono">{formatPhone(user.phone)}</td>
                  <td className="mono text-nowrap">{formatDateTime(user.lastLoginAt)}</td>
                  <td><StatusBadge status={user.status} /></td>
                  <td className="actions">
                    <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Edit ${user.fullName}`} onClick={() => setModal({ type: 'edit', user })}>
                      <Pencil size={15} />
                    </button>
                    {user.id !== me.id && (
                      <button type="button" className="btn btn--ghost btn--sm" disabled={pending === `reset-${user.id}`} onClick={() => resetPassword(user)}>
                        <KeyRound size={14} aria-hidden="true" /> Reset password
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="card__footer">
            <Pagination pagination={data.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </div>
        )}
      </section>

      {modal?.type === 'edit' && (
        <UserModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={(result) => {
            reload();
            if (result.temporaryPassword) setModal({ type: 'password', result });
            else {
              toast.success(`${result.user.fullName}'s account has been updated.`);
              setModal(null);
            }
          }}
        />
      )}
      {modal?.type === 'password' && <TemporaryPasswordModal result={modal.result} onClose={() => setModal(null)} />}
    </div>
  );
}
