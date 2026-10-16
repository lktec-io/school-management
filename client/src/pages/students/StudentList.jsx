import { ArrowDown, ArrowUp, ArrowUpDown, Eye, FilterX, GraduationCap, Pencil, Search, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import StudentAvatar from '../../components/ui/StudentAvatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { LEVEL_LABELS, classLabel, formatDate, formatPhone } from '../../utils/format.js';

const STATUS_FILTERS = ['active', 'all', 'suspended', 'transferred', 'graduated', 'withdrawn'];

function SortHeader({ field, label, sort, dir, onSort, className }) {
  const active = sort === field;
  const Icon = active ? (dir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th className={className} aria-sort={active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className={`sort-button${active ? ' is-active' : ''}`} onClick={() => onSort(field)}>
        {label} <Icon size={12} aria-hidden="true" />
      </button>
    </th>
  );
}

/** Student directory: search, class/stream/gender/status filters, sortable table (cards on phones). */
export default function StudentList() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const isStaff = hasRole('admin', 'accountant', 'teacher');
  const isAdmin = hasRole('admin');
  const [params, setParams] = useSearchParams();

  const filters = {
    search: params.get('search') || '',
    classId: params.get('classId') || '',
    streamId: params.get('streamId') || '',
    gender: params.get('gender') || '',
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
    gender: filters.gender,
    status: filters.status === 'all' ? '' : filters.status,
    sort: filters.sort,
    dir: filters.dir,
    page: filters.page,
    pageSize: 25,
  });

  const classList = classes.data ?? [];
  const streams = classList.find((cls) => String(cls.id) === filters.classId)?.streams ?? [];
  const hasFilters = Boolean(filters.search || filters.classId || filters.streamId || filters.gender || (isStaff && filters.status !== 'active'));

  const handleSort = (field) => {
    const dir = filters.sort === field && filters.dir === 'asc' ? 'desc' : 'asc';
    updateParams({ sort: field, dir });
  };
  const clearFilters = () => {
    setSearchInput('');
    setParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={isStaff ? t('students.eyebrow') : t('students.parentEyebrow')}
        title={isStaff ? t('nav.items.students') : t('nav.items.children')}
        subtitle={isStaff ? t('students.listSubtitle') : t('students.parentSubtitle')}
        actions={isAdmin && (
          <Link to="/students/register" className="btn btn--primary">
            <UserPlus size={16} aria-hidden="true" /> {t('students.register')}
          </Link>
        )}
      />

      {isStaff && (
        <section className="card filter-panel">
          <div className="filter-panel__row">
            <div className="filter-panel__search input-with-icon">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                className="form-control"
                placeholder={t('students.searchPlaceholder')}
                aria-label={t('students.searchLabel')}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <select className="form-control" aria-label={t('students.filterClass')} value={filters.classId}
              onChange={(event) => updateParams({ classId: event.target.value, streamId: '' })}>
              <option value="">{t('students.allClasses')}</option>
              {classList.map((cls) => <option key={cls.id} value={cls.id}>{cls.className} · {LEVEL_LABELS[cls.level]}</option>)}
            </select>
            <select className="form-control" aria-label={t('students.filterStream')} value={filters.streamId}
              onChange={(event) => updateParams({ streamId: event.target.value })} disabled={!streams.length}>
              <option value="">{t('students.allStreams')}</option>
              {streams.map((stream) => <option key={stream.id} value={stream.id}>{t('common.stream')} {stream.streamName}</option>)}
            </select>
            <select className="form-control" aria-label={t('students.filterGender')} value={filters.gender}
              onChange={(event) => updateParams({ gender: event.target.value })}>
              <option value="">{t('students.allGenders')}</option>
              <option value="female">{t('gender.female')}</option>
              <option value="male">{t('gender.male')}</option>
            </select>
          </div>
          <div className="filter-panel__row filter-panel__row--split">
            <div className="segmented" role="group" aria-label={t('students.filterStatus')}>
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`segmented__item${filters.status === status ? ' is-active' : ''}`}
                  aria-pressed={filters.status === status}
                  onClick={() => updateParams({ status })}
                >
                  {status === 'all' ? t('common.all') : t(`status.${status}`)}
                </button>
              ))}
            </div>
            <div className="filter-panel__meta">
              {data && <span className="text-sm text-muted">{t('students.found', { count: data.pagination.total })}</span>}
              {hasFilters && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilters}>
                  <FilterX size={14} aria-hidden="true" /> {t('common.clearFilters')}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <ErrorBlock error={error} onRetry={reload} />

      <section className="card">
        <div className="table-wrapper">
          <table className="data-table data-table--cards">
            <thead>
              <tr>
                <SortHeader field="name" label={t('common.student')} sort={filters.sort} dir={filters.dir} onSort={handleSort} />
                <SortHeader field="regNo" label={t('students.fields.regNo')} sort={filters.sort} dir={filters.dir} onSort={handleSort} />
                <SortHeader field="class" label={t('students.classStream')} sort={filters.sort} dir={filters.dir} onSort={handleSort} />
                <th>{t('students.guardian')}</th>
                <SortHeader field="admitted" label={t('students.admitted')} sort={filters.sort} dir={filters.dir} onSort={handleSort} />
                <th>{t('common.status')}</th>
                <th className="actions"><span className="sr-only">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr><td colSpan={7}><LoadingBlock rows={6} /></td></tr>
              )}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={GraduationCap} title={t('students.noneFound')} message={t('students.noneFoundHint')}
                      action={hasFilters ? <button type="button" className="btn btn--outline btn--sm" onClick={clearFilters}>{t('common.clearFilters')}</button> : null} />
                  </td>
                </tr>
              )}
              {data?.items.map((student) => (
                <tr key={student.id} className="row-link" onClick={() => navigate(`/students/${student.id}`)}>
                  <td data-label={t('common.student')}>
                    <div className="person-cell">
                      <StudentAvatar name={student.fullName} photoUrl={student.photoUrl} />
                      <span>
                        <span className="data-table__primary">{student.fullName}</span>
                        <span className="data-table__secondary">
                          {t(`gender.${student.gender}`)} · <span className="mono">{formatDate(student.dob)}</span>
                        </span>
                      </span>
                    </div>
                  </td>
                  <td data-label={t('students.fields.regNo')}><span className="reg-no">{student.registrationNumber}</span></td>
                  <td data-label={t('students.classStream')}>
                    <span className="data-table__primary">{classLabel(student.className, student.streamName)}</span>
                    <span className="data-table__secondary">{LEVEL_LABELS[student.level]}</span>
                  </td>
                  <td data-label={t('students.guardian')}>
                    <span>{student.parentName}</span>
                    <span className="data-table__secondary mono">{formatPhone(student.parentPhone)}</span>
                  </td>
                  <td data-label={t('students.admitted')} className="mono text-nowrap">{formatDate(student.admissionDate)}</td>
                  <td data-label={t('common.status')}><StatusBadge status={student.status} /></td>
                  <td className="actions" onClick={(event) => event.stopPropagation()}>
                    <Link to={`/students/${student.id}`} className="btn btn--ghost btn--icon btn--sm" aria-label={`${t('common.view')} ${student.fullName}`}>
                      <Eye size={15} />
                    </Link>
                    {isAdmin && (
                      <Link to={`/students/${student.id}/edit`} className="btn btn--ghost btn--icon btn--sm" aria-label={`${t('common.edit')} ${student.fullName}`}>
                        <Pencil size={15} />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.items.length > 0 && (
          <div className="card__footer">
            <Pagination pagination={data.pagination} onPageChange={(page) => updateParams({ page }, { resetPage: false })} />
          </div>
        )}
      </section>
    </div>
  );
}
