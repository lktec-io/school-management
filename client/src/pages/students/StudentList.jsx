import { ArrowDown, ArrowUp, ArrowUpDown, Eye, GraduationCap, Pencil, Search, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { LEVEL_LABELS, classLabel, formatDate, formatPhone } from '../../utils/format.js';
import StudentRegisterModal from './StudentRegisterModal.jsx';

const STATUSES = ['active', 'suspended', 'transferred', 'graduated', 'withdrawn'];

function SortHeader({ field, label, sort, dir, onSort, className }) {
  const active = sort === field;
  const Icon = active ? (dir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th className={className} aria-sort={active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="sort-button" onClick={() => onSort(field)}>
        {label} <Icon size={12} aria-hidden="true" />
      </button>
    </th>
  );
}

export default function StudentList() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const isStaff = hasRole('admin', 'accountant', 'teacher');
  const isAdmin = hasRole('admin');
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState(null);

  const filters = {
    search: params.get('search') || '',
    classId: params.get('classId') || '',
    streamId: params.get('streamId') || '',
    status: params.get('status') || (isStaff ? 'active' : 'all'),
    sort: params.get('sort') || 'name',
    dir: params.get('dir') || 'asc',
    page: Number(params.get('page')) || 1,
  };
  const [searchInput, setSearchInput] = useState(filters.search);

  const updateParams = (changes, { resetPage = true } = {}) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === null || value === undefined) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  // Debounce typing in the search box before hitting the API.
  useEffect(() => {
    if (searchInput === filters.search) return undefined;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (searchInput.trim()) next.set('search', searchInput.trim());
      else next.delete('search');
      next.delete('page');
      setParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, params, setParams]);

  const classes = useApi(isStaff ? '/academics/classes' : null);
  const { data, error, loading, reload } = useApi('/students', {
    search: filters.search,
    classId: filters.classId,
    streamId: filters.streamId,
    status: filters.status === 'all' ? '' : filters.status,
    sort: filters.sort,
    dir: filters.dir,
    page: filters.page,
    pageSize: 25,
  });

  const classList = classes.data ?? [];
  const streams = classList.find((cls) => String(cls.id) === filters.classId)?.streams ?? [];

  const handleSort = (field) => {
    const dir = filters.sort === field && filters.dir === 'asc' ? 'desc' : 'asc';
    updateParams({ sort: field, dir });
  };

  const handleSaved = (student) => {
    setModal(null);
    if (modal?.mode === 'create') navigate(`/students/${student.id}`);
    else reload();
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={isStaff ? 'Student lifecycle' : 'Parent portal'}
        title={isStaff ? 'Students' : 'My children'}
        subtitle={isStaff ? 'Search, filter and manage registered students.' : 'Students linked to your parent account.'}
        actions={isAdmin && (
          <button type="button" className="btn btn--primary" onClick={() => setModal({ mode: 'create' })} disabled={!classList.length}>
            <UserPlus size={16} aria-hidden="true" /> Register student
          </button>
        )}
      />

      {isStaff && (
        <div className="filter-bar card">
          <div className="filter-bar__search input-with-icon">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              className="form-control"
              placeholder="Search name, reg. no or guardian phone…"
              aria-label="Search students"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <select
            className="form-control"
            aria-label="Filter by class"
            value={filters.classId}
            onChange={(event) => updateParams({ classId: event.target.value, streamId: '' })}
          >
            <option value="">All classes</option>
            {classList.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.className} · {LEVEL_LABELS[cls.level]}</option>
            ))}
          </select>
          <select
            className="form-control"
            aria-label="Filter by stream"
            value={filters.streamId}
            onChange={(event) => updateParams({ streamId: event.target.value })}
            disabled={!streams.length}
          >
            <option value="">All streams</option>
            {streams.map((stream) => <option key={stream.id} value={stream.id}>Stream {stream.streamName}</option>)}
          </select>
          <div className="segmented" role="group" aria-label="Filter by status">
            {['active', 'all', ...STATUSES.filter((s) => s !== 'active')].map((status) => (
              <button
                key={status}
                type="button"
                className={`segmented__item${filters.status === status ? ' is-active' : ''}`}
                aria-pressed={filters.status === status}
                onClick={() => updateParams({ status })}
              >
                {status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <ErrorBlock error={error} onRetry={reload} />

      <section className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader field="regNo" label="Reg. No" sort={filters.sort} dir={filters.dir} onSort={handleSort} />
                <SortHeader field="name" label="Student" sort={filters.sort} dir={filters.dir} onSort={handleSort} />
                <SortHeader field="class" label="Class / Stream" sort={filters.sort} dir={filters.dir} onSort={handleSort} />
                <th>Guardian</th>
                <SortHeader field="admitted" label="Admitted" sort={filters.sort} dir={filters.dir} onSort={handleSort} />
                <th>Status</th>
                <th className="actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr><td colSpan={7}><LoadingBlock label="Loading students…" /></td></tr>
              )}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={GraduationCap} title="No students found" message="Try adjusting the search or filters." />
                  </td>
                </tr>
              )}
              {data?.items.map((student) => (
                <tr key={student.id} className="row-link" onClick={() => navigate(`/students/${student.id}`)}>
                  <td><span className="reg-no">{student.registrationNumber}</span></td>
                  <td>
                    <span className="data-table__primary">{student.fullName}</span>
                    <span className="data-table__secondary">{student.gender === 'male' ? 'Male' : 'Female'} · DOB <span className="mono">{formatDate(student.dob)}</span></span>
                  </td>
                  <td>{classLabel(student.className, student.streamName)}</td>
                  <td>
                    <span>{student.parentName}</span>
                    <span className="data-table__secondary mono">{formatPhone(student.parentPhone)}</span>
                  </td>
                  <td className="mono text-nowrap">{formatDate(student.admissionDate)}</td>
                  <td><StatusBadge status={student.status} /></td>
                  <td className="actions" onClick={(event) => event.stopPropagation()}>
                    <Link to={`/students/${student.id}`} className="btn btn--ghost btn--icon btn--sm" aria-label={`View ${student.fullName}`}>
                      <Eye size={15} />
                    </Link>
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon btn--sm"
                        aria-label={`Edit ${student.fullName}`}
                        onClick={() => setModal({ mode: 'edit', student })}
                      >
                        <Pencil size={15} />
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
            <Pagination pagination={data.pagination} onPageChange={(page) => updateParams({ page }, { resetPage: false })} />
          </div>
        )}
      </section>

      {modal && (
        <StudentRegisterModal
          student={modal.mode === 'edit' ? modal.student : null}
          classes={classList}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
