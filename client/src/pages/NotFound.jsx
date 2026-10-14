import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/Feedback.jsx';

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      message="The page you requested does not exist or has been moved."
      action={<Link to="/dashboard" className="btn btn--primary">Go to dashboard</Link>}
    />
  );
}
