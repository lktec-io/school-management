import { MessageSquareText, RotateCcw, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useApi } from '../../hooks/useApi.js';
import { formatDateTime, formatPhone } from '../../utils/format.js';
import { SMS_CATEGORY_LABELS } from '../../utils/sms.js';

const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
  { id: 'queued', label: 'Queued' },
];

export default function SmsLogsPanel({ batchId, onClearBatch }) {
  const [filters, setFilters] = useState({ status: '', category: '', search: '', dateFrom: '', dateTo: '', page: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const { run, pending } = useAsyncAction();

  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim(), page: 1 })), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, error, loading, reload } = useApi('/sms/logs', { ...filters, batchId, pageSize: 50 });
  const hasQueued = data?.items.some((log) => log.status === 'queued');

  // Refresh while messages are still being dispatched.
  useEffect(() => {
    if (!hasQueued) return undefined;
    const timer = setTimeout(reload, 3000);
    return () => clearTimeout(timer);
  }, [hasQueued, data, reload]);

  const update = (changes) => {
    setFilters((f) => ({ ...f, ...changes, page: 1 }));
    setSelected(new Set());
  };
  const failedOnPage = data?.items.filter((log) => log.status === 'failed').map((log) => log.id) ?? [];
  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const retry = (ids) => run('retry', () => api.post('/sms/retry', { ids }), `${ids.length} message(s) re-queued.`)
    .then(({ ok }) => {
      if (ok) {
        setSelected(new Set());
        reload();
      }
    });

  const counts = data?.statusCounts ?? {};

  return (
    <div className="stack">
      <div className="filter-bar card">
        <div className="segmented" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((option) => (
            <button key={option.id} type="button" className={`segmented__item${filters.status === option.id ? ' is-active' : ''}`}
              aria-pressed={filters.status === option.id} onClick={() => update({ status: option.id })}>
              {option.label}{option.id && counts[option.id] ? <span className="mono"> ({counts[option.id].total})</span> : null}
            </button>
          ))}
        </div>
        <div className="filter-bar__search input-with-icon">
          <Search size={16} aria-hidden="true" />
          <input type="search" className="form-control" placeholder="Phone, message, student or reg. no…" aria-label="Search SMS logs"
            value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        </div>
        <select className="form-control" aria-label="Category" value={filters.category} onChange={(event) => update({ category: event.target.value })}>
          <option value="">All categories</option>
          {Object.entries(SMS_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input type="date" className="form-control mono" aria-label="From date" value={filters.dateFrom} onChange={(event) => update({ dateFrom: event.target.value })} />
        <input type="date" className="form-control mono" aria-label="To date" value={filters.dateTo} onChange={(event) => update({ dateTo: event.target.value })} />
      </div>

      {(batchId || selected.size > 0) && (
        <div className="selection-bar">
          {batchId && (
            <span className="chip">
              Broadcast <span className="mono">{batchId.slice(0, 8)}</span>
              <button type="button" className="chip__close" onClick={onClearBatch} aria-label="Show all messages"><X size={12} /></button>
            </span>
          )}
          {selected.size > 0 && (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => retry([...selected])} disabled={pending === 'retry'}>
              {pending === 'retry' ? <span className="spinner spinner--light" aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}
              Retry {selected.size} failed
            </button>
          )}
          {hasQueued && <span className="text-sm text-muted"><span className="spinner" aria-hidden="true" /> Sending… refreshing automatically</span>}
        </div>
      )}

      <ErrorBlock error={error} onRetry={reload} />
      <section className="card">
        <div className="table-wrapper density-compact">
          <table className="data-table">
            <thead>
              <tr>
                <th className="center">
                  <input type="checkbox" aria-label="Select failed messages on this page" disabled={!failedOnPage.length}
                    checked={failedOnPage.length > 0 && failedOnPage.every((id) => selected.has(id))}
                    onChange={(event) => setSelected(event.target.checked ? new Set(failedOnPage) : new Set())} />
                </th>
                <th>Time</th><th>Recipient</th><th>Message</th><th className="numeric">Parts</th><th>Category</th><th>Status</th>
                <th className="actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && <tr><td colSpan={8}><LoadingBlock /></td></tr>}
              {data?.items.length === 0 && (
                <tr><td colSpan={8}><EmptyState icon={MessageSquareText} title="No messages" message="Sent messages and their delivery status appear here." /></td></tr>
              )}
              {data?.items.map((log) => (
                <tr key={log.id}>
                  <td className="center">
                    {log.status === 'failed' && (
                      <input type="checkbox" aria-label={`Select message to ${log.recipient}`} checked={selected.has(log.id)} onChange={() => toggle(log.id)} />
                    )}
                  </td>
                  <td className="mono text-nowrap">{formatDateTime(log.sentAt || log.createdAt)}</td>
                  <td>
                    <span className="mono">{formatPhone(log.recipient)}</span>
                    {log.studentName && <span className="data-table__secondary">{log.studentName}</span>}
                  </td>
                  <td className="log-message">
                    <span title={log.message}>{log.message}</span>
                    {log.errorMessage && <span className="data-table__secondary text-danger">{log.errorMessage}</span>}
                    {log.retryOf && <span className="data-table__secondary">Retry of #<span className="mono">{log.retryOf}</span></span>}
                  </td>
                  <td className="numeric">{log.segments}</td>
                  <td>{SMS_CATEGORY_LABELS[log.category]}</td>
                  <td><StatusBadge status={log.status} /></td>
                  <td className="actions">
                    {log.status === 'failed' && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => retry([log.id])} disabled={pending === 'retry'}>
                        <RotateCcw size={14} aria-hidden="true" /> Retry
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
    </div>
  );
}
