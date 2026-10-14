import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination) return null;
  const { page, pageSize, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__summary">
        Showing <span className="mono">{from}</span>–<span className="mono">{to}</span> of{' '}
        <span className="mono">{total}</span>
      </span>
      <div className="pagination__controls">
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft size={14} aria-hidden="true" /> Previous
        </button>
        <span className="pagination__page">
          Page <span className="mono">{page}</span> / <span className="mono">{totalPages}</span>
        </span>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
