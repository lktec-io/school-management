import { FileSpreadsheet, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { ACTION_GROUP_LABELS, actionTone, describeAction } from '../../utils/auditLabels.js';
import { downloadCsv } from '../../utils/finance.js';
import { ROLE_LABELS, formatDateTime, titleCase } from '../../utils/format.js';

const EMPTY_FILTERS = { userId: '', group: '', action: '', targetTable: '', ipAddress: '', dateFrom: '', dateTo: '', search: '', page: 1 };
const TONE_BADGE = { danger: 'badge--danger', finance: 'badge--success', academic: 'badge--info', system: 'badge--warning', neutral: '' };

function DetailModal({ entry, onClose }) {
  return (
    <Modal title={`Audit entry #${entry.id}`} size="lg" onClose={onClose}
      footer={<button type="button" className="btn btn--primary" onClick={onClose}>Close</button>}>
      <div className="stack">
        <dl className="definition-list">
          <dt>Time</dt><dd className="mono">{formatDateTime(entry.createdAt)}</dd>
          <dt>User</dt><dd>{entry.userName ? `${entry.userName} (${ROLE_LABELS[entry.userRole] ?? entry.userRole})` : 'System / unknown'}</dd>
          <dt>Action</dt><dd><span className="audit-action">{entry.action}</span> — {describeAction(entry.action)}</dd>
          <dt>Target</dt><dd className="mono">{entry.targetTable ? `${entry.targetTable}${entry.targetId ? ` #${entry.targetId}` : ''}` : '—'}</dd>
          <dt>IP address</dt><dd className="mono">{entry.ipAddress || '—'}</dd>
          <dt>Device</dt><dd className="text-sm">{entry.userAgent || '—'}</dd>
        </dl>
        <div>
          <div className="eyebrow">Recorded details</div>
          <pre className="json-view">{entry.details ? JSON.stringify(entry.details, null, 2) : 'No additional details.'}</pre>
        </div>
      </div>
    </Modal>
  );
}

export default function AuditLogs() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(null);
  const { run, pending } = useAsyncAction();
  const facets = useApi('/audit-logs/facets');
  const users = useApi('/users', { pageSize: 200 });

  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim(), page: 1 })), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryParams = {
    userId: filters.userId,
    action: filters.action || (filters.group ? `${filters.group}.` : ''),
    targetTable: filters.targetTable,
    ipAddress: filters.ipAddress.trim(),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    search: filters.search,
  };
  const { data, error, loading, reload } = useApi('/audit-logs', { ...queryParams, page: filters.page, pageSize: 50 });
  const update = (changes) => setFilters((f) => ({ ...f, ...changes, page: 1 }));
  const actionsInGroup = (facets.data?.actions ?? []).filter((row) => !filters.group || row.action.startsWith(`${filters.group}.`));

  const exportCsv = () => run('csv', async () => {
    const all = await api.get('/audit-logs', { ...queryParams, page: 1, pageSize: 500 });
    downloadCsv(
      `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Time', 'User', 'Role', 'Action', 'Description', 'Target table', 'Target ID', 'IP address', 'Details'],
      all.items.map((row) => [row.createdAt, row.userName ?? '', row.userRole ?? '', row.action, describeAction(row.action),
        row.targetTable ?? '', row.targetId ?? '', row.ipAddress ?? '', row.details ? JSON.stringify(row.details) : '']),
    );
  }, 'Audit entries exported (up to 500 rows).');

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Administration"
        title="Audit trail"
        subtitle="Every sign-in, payment, mark edit, SMS broadcast, account change and backup — who did it, when and from which IP address."
        actions={(
          <button type="button" className="btn btn--outline" onClick={exportCsv} disabled={!data?.items.length || pending === 'csv'}>
            <FileSpreadsheet size={16} aria-hidden="true" /> Export CSV
          </button>
        )}
      />

      <div className="filter-bar card">
        <div className="filter-bar__search input-with-icon">
          <Search size={16} aria-hidden="true" />
          <input type="search" className="form-control" placeholder="Search actions, users, IPs or details (e.g. RCT-2026-0004)…" aria-label="Search audit trail"
            value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        </div>
        <select className="form-control" aria-label="User" value={filters.userId} onChange={(event) => update({ userId: event.target.value })}>
          <option value="">All users</option>
          {(users.data?.items ?? []).map((user) => <option key={user.id} value={user.id}>{user.fullName} ({ROLE_LABELS[user.role]})</option>)}
        </select>
        <select className="form-control" aria-label="Action type" value={filters.group} onChange={(event) => update({ group: event.target.value, action: '' })}>
          <option value="">All action types</option>
          {(facets.data?.groups ?? []).map((row) => (
            <option key={row.group} value={row.group}>{ACTION_GROUP_LABELS[row.group] ?? titleCase(row.group)} ({row.total})</option>
          ))}
        </select>
        <select className="form-control" aria-label="Specific action" value={filters.action} onChange={(event) => update({ action: event.target.value })}>
          <option value="">Any action</option>
          {actionsInGroup.map((row) => <option key={row.action} value={row.action}>{row.action} ({row.total})</option>)}
        </select>
        <select className="form-control" aria-label="Record type" value={filters.targetTable} onChange={(event) => update({ targetTable: event.target.value })}>
          <option value="">All record types</option>
          {(facets.data?.targetTables ?? []).map((table) => <option key={table} value={table}>{table}</option>)}
        </select>
        <input className="form-control mono" placeholder="IP address" aria-label="IP address" value={filters.ipAddress}
          onChange={(event) => update({ ipAddress: event.target.value.replace(/[^0-9a-fA-F:.]/g, '') })} />
        <input type="date" className="form-control mono" aria-label="From date" value={filters.dateFrom} onChange={(event) => update({ dateFrom: event.target.value })} />
        <input type="date" className="form-control mono" aria-label="To date" value={filters.dateTo} onChange={(event) => update({ dateTo: event.target.value })} />
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setFilters(EMPTY_FILTERS); setSearchInput(''); }}>Reset filters</button>
      </div>

      <ErrorBlock error={error} onRetry={reload} />
      <section className="card">
        <div className="table-wrapper density-compact">
          <table className="data-table">
            <thead>
              <tr><th>Time</th><th>User</th><th>Action</th><th>Record</th><th>IP address</th><th className="actions"><span className="sr-only">Details</span></th></tr>
            </thead>
            <tbody>
              {loading && !data && <tr><td colSpan={6}><LoadingBlock label="Loading audit trail…" /></td></tr>}
              {data?.items.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={ShieldCheck} title="No matching activity" message="Adjust the filters to see more entries." /></td></tr>
              )}
              {data?.items.map((entry) => (
                <tr key={entry.id} className="row-link" onClick={() => setSelected(entry)}>
                  <td className="mono text-nowrap">{formatDateTime(entry.createdAt)}</td>
                  <td>
                    <span className="data-table__primary">{entry.userName || 'System'}</span>
                    {entry.userRole && <span className="data-table__secondary">{ROLE_LABELS[entry.userRole]}</span>}
                  </td>
                  <td>
                    <span className={`badge badge--plain ${TONE_BADGE[actionTone(entry.action)]}`}><span className="audit-action">{entry.action}</span></span>
                    <span className="data-table__secondary">{describeAction(entry.action)}</span>
                  </td>
                  <td className="mono text-sm">{entry.targetTable ? `${entry.targetTable}${entry.targetId ? ` #${entry.targetId}` : ''}` : '—'}</td>
                  <td className="mono text-sm">{entry.ipAddress || '—'}</td>
                  <td className="actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={(event) => { event.stopPropagation(); setSelected(entry); }}>Details</button>
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

      {selected && <DetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
