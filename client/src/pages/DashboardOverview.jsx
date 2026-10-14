import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminDashboard from '../components/dashboards/AdminDashboard.jsx';
import BursarDashboard from '../components/dashboards/BursarDashboard.jsx';
import ParentDashboard from '../components/dashboards/ParentDashboard.jsx';
import TeacherDashboard from '../components/dashboards/TeacherDashboard.jsx';
import { ErrorBlock, InlineAlert, LoadingBlock } from '../components/ui/Feedback.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';

const SUBTITLES = {
  admin: 'Headmaster portal — school-wide enrolment, finance, academics and activity.',
  teacher: 'Teacher portal — your classes, pending marks and latest results.',
  accountant: 'Bursar portal — cash inflow, unpaid bills and expenditure.',
  parent: 'Parent portal — balances, report cards and receipts for your children.',
};

function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Routes each role to its own dashboard portal. */
export default function DashboardOverview() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi('/dashboard/summary');

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={data?.period?.term ? `${data.period.term.termName} · ${data.period.academicYear.yearLabel}` : 'Dashboard'}
        title={`${greetingFor(new Date())}, ${user.fullName.split(' ')[0]}`}
        subtitle={SUBTITLES[user.role]}
      />
      {loading && !data && <LoadingBlock label="Loading dashboard…" />}
      <ErrorBlock error={error} onRetry={reload} />
      {data?.role === 'admin' && !data.period.term && (
        <InlineAlert tone="warning" title="Academic calendar not configured" icon={TriangleAlert}>
          <p>Set the current academic year and term in <Link to="/academics?tab=calendar">Academic Setup</Link> to enable exams and fee tracking.</p>
        </InlineAlert>
      )}
      {data?.role === 'admin' && <AdminDashboard data={data} />}
      {data?.role === 'teacher' && <TeacherDashboard data={data} />}
      {data?.role === 'accountant' && <BursarDashboard data={data} onChanged={reload} />}
      {data?.role === 'parent' && <ParentDashboard data={data} />}
    </div>
  );
}
