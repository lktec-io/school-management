import { Ban, Plus, Search, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import FormModal from '../../components/ui/FormModal.jsx';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import PaymentModeBadge from '../../components/ui/PaymentModeBadge.jsx';
import ReasonModal from '../../components/ui/ReasonModal.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useForm } from '../../hooks/useForm.js';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_MODE_LABELS, formatDate, formatMoney, todayIso } from '../../utils/format.js';
import { useTranslation } from 'react-i18next';

function ExpenseModal({ onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({
    category: 'utilities', description: '', payee: '', amount: '', expenseDate: todayIso(), paymentMode: 'bank_transfer', referenceNo: '',
  });
  return (
    <FormModal
      title="Record expense"
      form={form}
      onClose={onClose}
      submitLabel="Record expense"
      onSubmit={async (values) => {
        const expense = await api.post('/finance/expenses', values);
        toast.success(`Expense ${expense.expenseNo} recorded.`);
        onSaved();
      }}
    >
      <div className="form-grid form-grid--2">
        <FormField label="Category" required error={form.errors.category}>
          <select className="form-control" {...form.bind('category')}>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Amount (TZS)" required error={form.errors.amount}>
          <input className="form-control mono amount-input" inputMode="decimal" {...form.bind('amount')} />
        </FormField>
        <FormField label="Description" required error={form.errors.description} className="span-2" hint="e.g. ZECO electricity bill — September">
          <input className="form-control" maxLength={255} {...form.bind('description')} />
        </FormField>
        <FormField label="Paid to (payee)" error={form.errors.payee}>
          <input className="form-control" maxLength={150} {...form.bind('payee')} />
        </FormField>
        <FormField label="Date" required error={form.errors.expenseDate}>
          <input type="date" className="form-control mono" max={todayIso()} {...form.bind('expenseDate')} />
        </FormField>
        <FormField label="Payment method" required error={form.errors.paymentMode}>
          <select className="form-control" {...form.bind('paymentMode')}>
            {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Reference" error={form.errors.referenceNo}>
          <input className="form-control mono" maxLength={100} {...form.bind('referenceNo')} />
        </FormField>
      </div>
    </FormModal>
  );
}

export default function ExpensesList() {
  const { t } = useTranslation();
  const toast = useToast();
  const [filters, setFilters] = useState({ category: '', status: 'recorded', dateFrom: '', dateTo: '', search: '', page: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim(), page: 1 })), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, error, loading, reload } = useApi('/finance/expenses', { ...filters, pageSize: 25 });
  const update = (changes) => setFilters((f) => ({ ...f, ...changes, page: 1 }));
  const maxCategory = Math.max(1, ...(data?.breakdown ?? []).map((row) => row.amount));

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={t('nav.sections.finance')}
        title={t('pages.expenses.title')}
        subtitle={t('pages.expenses.subtitle')}
        actions={(
          <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'create' })}>
            <Plus size={16} aria-hidden="true" /> Record expense
          </button>
        )}
      />

      <div className="filter-bar card">
        <div className="filter-bar__search input-with-icon">
          <Search size={16} aria-hidden="true" />
          <input type="search" className="form-control" placeholder="Expense no, description, payee, reference…" aria-label="Search expenses"
            value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        </div>
        <select className="form-control" aria-label="Category" value={filters.category} onChange={(event) => update({ category: event.target.value })}>
          <option value="">All categories</option>
          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="form-control" aria-label="Status" value={filters.status} onChange={(event) => update({ status: event.target.value })}>
          <option value="recorded">Recorded</option>
          <option value="voided">Voided</option>
          <option value="">All</option>
        </select>
        <input type="date" className="form-control mono" aria-label="From date" value={filters.dateFrom} onChange={(event) => update({ dateFrom: event.target.value })} />
        <input type="date" className="form-control mono" aria-label="To date" value={filters.dateTo} onChange={(event) => update({ dateTo: event.target.value })} />
      </div>

      <ErrorBlock error={error} onRetry={reload} />

      <div className="finance-split">
        <section className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Expense no.</th><th>Date</th><th>Category</th><th>Description</th><th>Method</th>
                  <th className="numeric">Amount (TZS)</th><th>Status</th><th className="actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {loading && !data && <tr><td colSpan={8}><LoadingBlock /></td></tr>}
                {data?.items.length === 0 && (
                  <tr><td colSpan={8}><EmptyState icon={Wallet} title="No expenses found" /></td></tr>
                )}
                {data?.items.map((expense) => (
                  <tr key={expense.id} className={expense.status === 'voided' ? 'is-muted' : undefined}>
                    <td><span className="receipt-no">{expense.expenseNo}</span></td>
                    <td className="mono text-nowrap">{formatDate(expense.expenseDate)}</td>
                    <td>{EXPENSE_CATEGORY_LABELS[expense.category]}</td>
                    <td>
                      <span className="data-table__primary">{expense.description}</span>
                      <span className="data-table__secondary">
                        {expense.payee && <>{expense.payee} · </>}{expense.referenceNo && <span className="mono">{expense.referenceNo} · </span>}by {expense.recordedByName}
                      </span>
                    </td>
                    <td><PaymentModeBadge mode={expense.paymentMode} /></td>
                    <td className="numeric"><strong>{formatMoney(expense.amount)}</strong></td>
                    <td>
                      <StatusBadge status={expense.status} />
                      {expense.voidReason && <span className="data-table__secondary">{expense.voidReason}</span>}
                    </td>
                    <td className="actions">
                      {expense.status === 'recorded' && (
                        <button type="button" className="btn btn--ghost btn--icon btn--sm text-danger" aria-label={`Void ${expense.expenseNo}`}
                          onClick={() => setModal({ type: 'void', expense })}>
                          <Ban size={15} />
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

        <section className="card">
          <div className="card__header"><h2 className="card__title">By category</h2></div>
          <div className="card__body stack">
            {data?.breakdown.length === 0 && <p className="text-sm text-muted">No recorded expenses for these filters.</p>}
            {data?.breakdown.map((row) => (
              <div key={row.category} className="breakdown-row">
                <div className="split-row">
                  <span>{EXPENSE_CATEGORY_LABELS[row.category]} <span className="text-xs text-muted mono">({row.entries})</span></span>
                  <span className="amount">{formatMoney(row.amount)}</span>
                </div>
                <span className="bar" aria-hidden="true"><span className="bar__fill bar__fill--danger" style={{ width: `${Math.max(2, (row.amount / maxCategory) * 100)}%` }} /></span>
              </div>
            ))}
            {data && (
              <div className="split-row breakdown-total">
                <strong>Total recorded</strong>
                <strong className="amount">{formatMoney(data.totalRecorded)}</strong>
              </div>
            )}
          </div>
        </section>
      </div>

      {modal?.type === 'create' && <ExpenseModal onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
      {modal?.type === 'void' && (
        <ReasonModal
          title={`Void expense ${modal.expense.expenseNo}`}
          confirmLabel="Void expense"
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            await api.post(`/finance/expenses/${modal.expense.id}/void`, { reason });
            toast.success(`${modal.expense.expenseNo} voided.`);
            setModal(null);
            reload();
          }}
        >
          <p className="text-sm">
            <span className="amount">{formatMoney(modal.expense.amount)}</span> — {modal.expense.description}. The entry stays on record, marked as voided.
          </p>
        </ReasonModal>
      )}
    </div>
  );
}
