import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireRole } from './components/auth/ProtectedRoute.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import TopProgressBar, { RouteProgress } from './components/ui/TopProgressBar.jsx';
import DashboardOverview from './pages/DashboardOverview.jsx';
import LandingPage from './pages/LandingPage.jsx';
import NotFound from './pages/NotFound.jsx';

// Feature screens load on demand so the first paint stays small on school/mobile connections.
const AcademicSetup = lazy(() => import('./pages/academics/AcademicSetup.jsx'));
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'));
const ExpensesList = lazy(() => import('./pages/finance/ExpensesList.jsx'));
const FeeDefaulters = lazy(() => import('./pages/finance/FeeDefaulters.jsx'));
const FeeSetup = lazy(() => import('./pages/finance/fees/FeeSetup.jsx'));
const FinanceOverview = lazy(() => import('./pages/finance/FinanceOverview.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const MarksEntry = lazy(() => import('./pages/marks/MarksEntry.jsx'));
const PaymentList = lazy(() => import('./pages/finance/PaymentList.jsx'));
const ReportCardView = lazy(() => import('./pages/reports/ReportCardView.jsx'));
const SchoolSettings = lazy(() => import('./pages/system/SchoolSettings.jsx'));
const SmsCenter = lazy(() => import('./pages/sms/SmsCenter.jsx'));
const StudentForm = lazy(() => import('./pages/students/StudentForm.jsx'));
const StudentList = lazy(() => import('./pages/students/StudentList.jsx'));
const StudentProfile = lazy(() => import('./pages/students/StudentProfile.jsx'));
const UserManagement = lazy(() => import('./pages/users/UserManagement.jsx'));

const ALL = ['admin', 'accountant', 'teacher', 'parent'];
const FINANCE = ['admin', 'accountant'];

function page(element, roles) {
  const content = <Suspense fallback={<RouteProgress />}>{element}</Suspense>;
  return roles ? <RequireRole roles={roles}>{content}</RequireRole> : content;
}

export default function App() {
  // Subscribing here re-renders the whole tree when the language changes, so label maps
  // read outside React hooks (format.js) pick up the new language too.
  useTranslation();

  return (
    <>
      <TopProgressBar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Suspense fallback={<RouteProgress />}><LoginPage /></Suspense>} />
        <Route
          element={(
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          )}
        >
          <Route path="dashboard" element={<DashboardOverview />} />
          <Route path="students" element={page(<StudentList />, ALL)} />
          <Route path="students/register" element={page(<StudentForm />, ['admin'])} />
          <Route path="students/:id/edit" element={page(<StudentForm />, ['admin'])} />
          <Route path="students/:id" element={page(<StudentProfile />, ALL)} />
          <Route path="academics" element={page(<AcademicSetup />, ['admin'])} />
          <Route path="marks" element={page(<MarksEntry />, ['admin', 'teacher'])} />
          <Route path="reports" element={page(<ReportCardView />, ['admin', 'teacher', 'parent'])} />
          <Route path="users" element={page(<UserManagement />, ['admin'])} />
          <Route path="settings" element={page(<SchoolSettings />, ['admin'])} />
          <Route path="finance" element={page(<FinanceOverview />, FINANCE)} />
          <Route path="finance/payments" element={page(<PaymentList />, FINANCE)} />
          <Route path="finance/defaulters" element={page(<FeeDefaulters />, FINANCE)} />
          <Route path="finance/fees" element={page(<FeeSetup />, FINANCE)} />
          <Route path="finance/expenses" element={page(<ExpensesList />, FINANCE)} />
          <Route path="sms" element={page(<SmsCenter />, FINANCE)} />
          <Route path="account/password" element={page(<ChangePassword />)} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
