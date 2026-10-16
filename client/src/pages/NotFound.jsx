import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/Feedback.jsx';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Compass}
      title={t('pages.notFound.title')}
      message={t('pages.notFound.message')}
      action={<Link to="/dashboard" className="btn btn--primary">{t('feedback.returnDashboard')}</Link>}
    />
  );
}
