import { TriangleAlert } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import NewsCard, { NewsTicker } from '../components/dashboards/NewsCard.jsx';
import { ErrorBlock, InlineAlert, PageSkeleton } from '../components/ui/Feedback.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';

// Charts (Recharts) are only downloaded with the dashboard that uses them.
const AdminDashboard = lazy(() => import('../components/dashboards/AdminDashboard.jsx'));
const BursarDashboard = lazy(() => import('../components/dashboards/BursarDashboard.jsx'));
const ParentDashboard = lazy(() => import('../components/dashboards/ParentDashboard.jsx'));
const TeacherDashboard = lazy(() => import('../components/dashboards/TeacherDashboard.jsx'));

function greetingKey(date) {
  const hour = date.getHours();
  if (hour < 12) return 'dash.greeting.morning';
  if (hour < 17) return 'dash.greeting.afternoon';
  return 'dash.greeting.evening';
}

/** Routes each role to its own dashboard portal. */
export default function DashboardOverview() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi('/dashboard/summary');

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={data?.period?.term ? `${data.period.term.termName} · ${data.period.academicYear.yearLabel}` : t('nav.items.dashboard')}
        title={`${t(greetingKey(new Date()))}, ${user.fullName.split(' ')[0]}`}
        subtitle={t(`dash.subtitle.${user.role}`)}
      />
      <NewsTicker />
      {loading && !data && <PageSkeleton variant="dashboard" />}
      <ErrorBlock error={error} onRetry={reload} />
      {data?.role === 'admin' && !data.period.term && (
        <InlineAlert tone="warning" title={t('dash.calendarMissing')} icon={TriangleAlert}>
          <p><Trans i18nKey="dash.calendarMissingHint" components={{ setup: <Link to="/academics?tab=calendar" /> }} /></p>
        </InlineAlert>
      )}
      {data && (
        <Suspense fallback={<PageSkeleton variant="dashboard" />}>
          {data.role === 'admin' && <AdminDashboard data={data} />}
          {data.role === 'teacher' && <TeacherDashboard data={data} />}
          {data.role === 'accountant' && <BursarDashboard data={data} onChanged={reload} />}
          {data.role === 'parent' && <ParentDashboard data={data} />}
        </Suspense>
      )}
      {data && <NewsCard />}
    </div>
  );
}
