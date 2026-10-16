import { Download, Plus, Receipt, Search, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import PaymentModeBadge from '../../components/ui/PaymentModeBadge.jsx';
import ReasonModal from '../../components/ui/ReasonModal.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { downloadReceipt } from '../../utils/finance.js';
import { PAYMENT_MODE_LABELS, classLabel, formatDate, formatMoney } from '../../utils/format.js';
import RecordPaymentModal from './RecordPaymentModal.jsx';
import { useTranslation } from 'react-i18next';

const EMPTY_FILTERS = { search: '', termId: '', paymentMode: '', status: '', dateFrom: '', dateTo: '', page: 1 };

export default function PaymentList() {
  const { t } = useTranslation();
  const toast = useToast();
  const [params] = useSearchParams();
  // Dashboard charts link here with a payment mode or month range pre-selected.
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    paymentMode: params.get('paymentMode') || '',
    dateFrom: params.get('dateFrom') || '',
    dateTo: params.get('dateTo') || '',
  }));
  const [searchInput, setSearchInput] = useState('');
  const [modal, setModal] = useState(null);
  const { run, pending } = useAsyncAction();
  const years = useApi('/academics/years');

  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim(), page: 1 })), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, error, loading, reload } = useApi('/finance/payments', { ...filters, pageSize: 25 });
  const update = (changes) => setFilters((f) => ({ ...f, ...changes, page: 1 }));

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={t('nav.sections.finance')}
        title={t('pages.payments.title')}
        subtitle={t('pages.payments.subtitle')}
        actions={(
          <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'record' })}>
            <Plus size={16} aria-hidden="true" /> Record payment
          </button>
        )}
      />

      <div className="filter-bar card">
        <div className="filter-bar__search input-with-icon">
          <Search size={16} aria-hidden="true" />
          <input type="search" className="form-control" placeholder="Receipt no, reference, student name or reg. no…" aria-label="Search payments"
            value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        </div>
        <select className="form-control" aria-label="Term" value={filters.termId} onChange={(event) => update({ termId: event.target.value })}>
          <option value="">All terms</option>
          {(years.data ?? []).map((year) => (
            <optgroup key={year.id} label={year.yearLabel}>
              {year.terms.map((t) => <option key={t.id} value={t.id}>{t.termName} {year.yearLabel}</option>)}
            </optgroup>
          ))}
        </select>
        <select className="form-control" aria-label="Payment method" value={filters.paymentMode} onChange={(event) => update({ paymentMode: event.target.value })}>
          <option value="">All methods</option>
          {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="form-control" aria-label="Status" value={filters.status} onChange={(event) => update({ status: event.target.value })}>
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="reversed">Reversed</option>
        </select>
        <input type="date" className="form-control mono" aria-label="From date" value={filters.dateFrom} onChange={(event) => update({ dateFrom: event.target.value })} />
        <input type="date" className="form-control mono" aria-label="To date" value={filters.dateTo} onChange={(event) => update({ dateTo: event.target.value })} />
      </div>

      {data && (
        <div className="totals-bar">
          <span>Confirmed <strong className="amount">{formatMoney(data.totals.confirmedAmount)}</strong> <span className="mono text-muted">({data.totals.confirmedCount})</span></span>
          {data.totals.reversedAmount > 0 && <span>Reversed <strong className="amount amount--negative">{formatMoney(data.totals.reversedAmount)}</strong></span>}
        </div>
      )}

      <ErrorBlock error={error} onRetry={reload} />
      <section className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt no.</th><th>Date</th><th>Student</th><th>Term</th><th>Fee item</th><th>Method</th>
                <th>Reference</th><th className="numeric">Amount (TZS)</th><th>Status</th>
                <th className="actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && <tr><td colSpan={10}><LoadingBlock label="Loading payments…" /></td></tr>}
              {data?.items.length === 0 && (
                <tr><td colSpan={10}><EmptyState icon={Receipt} title="No payments found" message="Adjust the filters or record a new payment." /></td></tr>
              )}
              {data?.items.map((payment) => (
                <tr key={payment.id} className={payment.status === 'reversed' ? 'is-muted' : undefined}>
                  <td><span className="receipt-no">{payment.receiptNo}</span></td>
                  <td className="mono text-nowrap">{formatDate(payment.paymentDate)}</td>
                  <td>
                    <span className="data-table__primary">{payment.fullName}</span>
                    <span className="data-table__secondary"><span className="mono">{payment.registrationNumber}</span> · {classLabel(payment.className, payment.streamName)}</span>
                  </td>
                  <td>{payment.termName} <span className="mono text-muted">{payment.yearLabel}</span></td>
                  <td>{payment.feeTypeName || 'General'}</td>
                  <td><PaymentModeBadge mode={payment.paymentMode} /></td>
                  <td className="mono">{payment.referenceNo || '—'}</td>
                  <td className="numeric"><strong>{formatMoney(payment.amountPaid)}</strong></td>
                  <td>
                    <StatusBadge status={payment.status} />
                    {payment.status === 'reversed' && <span className="data-table__secondary" title={payment.reversalReason}>{payment.reversalReason}</span>}
                  </td>
                  <td className="actions">
                    <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Download receipt ${payment.receiptNo}`}
                      disabled={pending === `pdf-${payment.id}`} onClick={() => run(`pdf-${payment.id}`, () => downloadReceipt(payment))}>
                      {pending === `pdf-${payment.id}` ? <span className="spinner" aria-hidden="true" /> : <Download size={15} />}
                    </button>
                    {payment.status === 'confirmed' && (
                      <button type="button" className="btn btn--ghost btn--icon btn--sm text-danger" aria-label={`Reverse ${payment.receiptNo}`}
                        onClick={() => setModal({ type: 'reverse', payment })}>
                        <Undo2 size={15} />
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

      {modal?.type === 'record' && <RecordPaymentModal onClose={() => setModal(null)} onRecorded={reload} />}
      {modal?.type === 'reverse' && (
        <ReasonModal
          title={`Reverse payment ${modal.payment.receiptNo}`}
          confirmLabel="Reverse payment"
          label="Reason for reversal"
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            const result = await api.post(`/finance/payments/${modal.payment.id}/reverse`, { reason });
            toast.success(`${modal.payment.receiptNo} reversed. New balance: TZS ${formatMoney(result.balance.balance)}.`);
            setModal(null);
            reload();
          }}
        >
          <p className="text-sm">
            <span className="amount">{formatMoney(modal.payment.amountPaid)}</span> from <strong>{modal.payment.fullName}</strong> will be
            removed from the student&apos;s paid total. The receipt stays on record, marked as reversed.
          </p>
        </ReasonModal>
      )}
    </div>
  );
}
