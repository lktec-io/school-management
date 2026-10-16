import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Pagination({ pagination, onPageChange }) {
  const { t } = useTranslation();
  if (!pagination) return null;
  const { page, pageSize, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label={t('pagination.label')}>
      <span className="pagination__summary">
        {t('pagination.showing')} <span className="mono">{from}</span>–<span className="mono">{to}</span> {t('pagination.of')}{' '}
        <span className="mono">{total}</span>
      </span>
      <div className="pagination__controls">
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft size={14} aria-hidden="true" /> {t('common.previous')}
        </button>
        <span className="pagination__page">
          {t('pagination.page')} <span className="mono">{page}</span> / <span className="mono">{totalPages}</span>
        </span>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {t('common.next')} <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
