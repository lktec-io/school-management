import { FileSpreadsheet, MessageSquareWarning, Receipt, Search, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import SmsComposeModal from '../../components/sms/SmsComposeModal.jsx';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { useAcademicPeriod } from '../../context/AcademicContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { downloadCsv } from '../../utils/finance.js';
import { classLabel, formatDate, formatMoney, formatPhone } from '../../utils/format.js';
import { FEE_REMINDER_TEMPLATE } from '../../utils/sms.js';
import RecordPaymentModal from './RecordPaymentModal.jsx';

export default function FeeDefaulters() {
  const toast = useToast();
  const { term } = useAcademicPeriod();
  const [filters, setFilters] = useState({ termId: term ? String(term.id) : '', classId: '', streamId: '', minBalance: '', search: '', page: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [modal, setModal] = useState(null);
  const { run, pending } = useAsyncAction();
  const years = useApi('/academics/years');
  const classes = useApi('/academics/classes');

  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim(), page: 1 })), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, error, loading, reload } = useApi(filters.termId ? '/finance/defaulters' : null, { ...filters, pageSize: 50 });
  const streams = (classes.data ?? []).find((cls) => String(cls.id) === filters.classId)?.streams ?? [];

  const update = (changes) => {
    setFilters((f) => ({ ...f, ...changes, page: 1 }));
    setSelected(new Set());
  };
  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const pageIds = data?.items.map((row) => row.studentId) ?? [];
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const exportCsv = () => run('csv', async () => {
    const all = await api.get('/finance/defaulters', { ...filters, page: 1, pageSize: 500 });
    downloadCsv(
      `fee-defaulters-${all.term.termName}-${all.term.yearLabel}.csv`.replace(/\s+/g, '-').toLowerCase(),
      ['Reg No', 'Student', 'Class', 'Guardian', 'Guardian Phone', 'Bill (TZS)', 'Paid (TZS)', 'Balance (TZS)', 'Last Payment'],
      all.items.map((row) => [row.registrationNumber, row.fullName, classLabel(row.className, row.streamName), row.parentName,
        row.parentPhone, row.expected, row.paid, row.balance, row.lastPaymentDate ?? '']),
    );
  }, 'Defaulters list exported.');

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Finance"
        title="Fee defaulters"
        subtitle="Students with an unpaid balance for the selected term, largest debt first."
        actions={(
          <>
            <button type="button" className="btn btn--outline" onClick={exportCsv} disabled={!data?.items.length || pending === 'csv'}>
              <FileSpreadsheet size={16} aria-hidden="true" /> Export CSV
            </button>
            <button type="button" className="btn btn--primary" disabled={selected.size === 0} onClick={() => setModal({ type: 'sms' })}>
              <MessageSquareWarning size={16} aria-hidden="true" /> Send fee reminder SMS{selected.size ? ` (${selected.size})` : ''}
            </button>
          </>
        )}
      />

      <div className="filter-bar card">
        <div className="filter-bar__search input-with-icon">
          <Search size={16} aria-hidden="true" />
          <input type="search" className="form-control" placeholder="Student name or reg. no…" aria-label="Search defaulters"
            value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        </div>
        <select className="form-control" aria-label="Term" value={filters.termId} onChange={(event) => update({ termId: event.target.value })}>
          <option value="">Select term…</option>
          {(years.data ?? []).map((year) => (
            <optgroup key={year.id} label={year.yearLabel}>
              {year.terms.map((t) => <option key={t.id} value={t.id}>{t.termName} {year.yearLabel}</option>)}
            </optgroup>
          ))}
        </select>
        <select className="form-control" aria-label="Class" value={filters.classId} onChange={(event) => update({ classId: event.target.value, streamId: '' })}>
          <option value="">All classes</option>
          {(classes.data ?? []).map((cls) => <option key={cls.id} value={cls.id}>{cls.className}</option>)}
        </select>
        <select className="form-control" aria-label="Stream" value={filters.streamId} onChange={(event) => update({ streamId: event.target.value })} disabled={!streams.length}>
          <option value="">All streams</option>
          {streams.map((stream) => <option key={stream.id} value={stream.id}>Stream {stream.streamName}</option>)}
        </select>
        <input className="form-control mono" inputMode="decimal" placeholder="Min. balance (TZS)" aria-label="Minimum balance"
          value={filters.minBalance} onChange={(event) => update({ minBalance: event.target.value.replace(/[^\d.]/g, '') })} />
      </div>

      {data && (
        <div className="stat-grid stat-grid--compact">
          <div className="stat-tile stat-tile--danger"><div className="stat-tile__label">Students owing</div><div className="stat-tile__value mono">{data.totals.students}</div></div>
          <div className="stat-tile stat-tile--danger"><div className="stat-tile__label">Total arrears (TZS)</div><div className="stat-tile__value mono">{formatMoney(data.totals.totalDebt)}</div></div>
          <div className="stat-tile"><div className="stat-tile__label">Billed to these students</div><div className="stat-tile__value mono">{formatMoney(data.totals.totalExpected)}</div></div>
          <div className="stat-tile stat-tile--success"><div className="stat-tile__label">Already paid</div><div className="stat-tile__value mono">{formatMoney(data.totals.totalPaid)}</div></div>
        </div>
      )}

      {data && selected.size > 0 && (
        <div className="selection-bar">
          <span><strong className="mono">{selected.size}</strong> selected</span>
          {selected.size < data.allStudentIds.length && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(new Set(data.allStudentIds))}>
              Select all {data.allStudentIds.length} matching
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <ErrorBlock error={error} onRetry={reload} />
      <section className="card">
        <div className="table-wrapper density-compact">
          <table className="data-table">
            <thead>
              <tr>
                <th className="center">
                  <input type="checkbox" aria-label="Select all on this page" checked={allPageSelected}
                    onChange={() => setSelected((current) => {
                      const next = new Set(current);
                      pageIds.forEach((id) => (allPageSelected ? next.delete(id) : next.add(id)));
                      return next;
                    })} />
                </th>
                <th>Reg. no</th><th>Student</th><th>Class</th><th>Guardian</th>
                <th className="numeric">Bill</th><th className="numeric">Paid</th><th className="numeric">Balance (TZS)</th>
                <th>Last payment</th><th className="actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {!filters.termId && <tr><td colSpan={10} className="data-table__empty">Select a term.</td></tr>}
              {loading && !data && <tr><td colSpan={10}><LoadingBlock label="Calculating balances…" /></td></tr>}
              {data?.items.length === 0 && (
                <tr><td colSpan={10}><EmptyState icon={UserCheck} title="No defaulters" message="Every student matching these filters is fully paid." /></td></tr>
              )}
              {data?.items.map((row) => (
                <tr key={row.studentId} aria-selected={selected.has(row.studentId)}>
                  <td className="center">
                    <input type="checkbox" aria-label={`Select ${row.fullName}`} checked={selected.has(row.studentId)} onChange={() => toggle(row.studentId)} />
                  </td>
                  <td><span className="reg-no">{row.registrationNumber}</span></td>
                  <td><Link to={`/students/${row.studentId}`} className="data-table__primary">{row.fullName}</Link></td>
                  <td>{classLabel(row.className, row.streamName)}</td>
                  <td>
                    <span>{row.parentName}</span>
                    <span className="data-table__secondary mono">{formatPhone(row.parentPhone)}</span>
                  </td>
                  <td className="numeric">{formatMoney(row.expected)}</td>
                  <td className="numeric">{formatMoney(row.paid)}</td>
                  <td className="numeric"><strong className="text-danger">{formatMoney(row.balance)}</strong></td>
                  <td className="mono text-nowrap">{row.lastPaymentDate ? formatDate(row.lastPaymentDate) : <span className="text-muted">Never</span>}</td>
                  <td className="actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setModal({ type: 'pay', student: {
                      id: row.studentId, fullName: row.fullName, registrationNumber: row.registrationNumber, className: row.className, streamName: row.streamName,
                    } })}>
                      <Receipt size={14} aria-hidden="true" /> Pay
                    </button>
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

      {modal?.type === 'sms' && (
        <SmsComposeModal
          title="Send fee reminder SMS"
          description={`Personalised reminders to the guardians of ${selected.size} selected student(s). {balance} uses each student's balance for the selected term.`}
          target={{ type: 'students', studentIds: [...selected], termId: Number(filters.termId) }}
          defaultMessage={FEE_REMINDER_TEMPLATE}
          category="fee_reminder"
          onClose={() => setModal(null)}
          onSent={() => {
            setModal(null);
            setSelected(new Set());
            toast.info('Track delivery in SMS Center → Delivery logs.');
          }}
        />
      )}
      {modal?.type === 'pay' && (
        <RecordPaymentModal student={modal.student} onClose={() => setModal(null)} onRecorded={reload} />
      )}
    </div>
  );
}
