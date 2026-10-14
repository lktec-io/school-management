import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSchoolProfile } from '../../hooks/useSchoolProfile.js';
import Crest from './Crest.jsx';
import { NAV_SECTIONS } from './navigation.js';

export default function Sidebar({ open, onNavigate }) {
  const { user } = useAuth();
  const school = useSchoolProfile();

  const sections = NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => item.roles.includes(user.role)) }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className={`app-sidebar${open ? ' is-open' : ''}`} aria-label="Main navigation">
      <div className="app-sidebar__brand">
        <Crest name={school?.name || ''} size={38} inverted logoSrc={school?.logoSrc} />
        <div className="app-sidebar__brand-text">
          <span className="app-sidebar__school">{school?.name || 'School Portal'}</span>
          <span className="app-sidebar__tagline">Management Portal</span>
        </div>
      </div>
      <nav className="app-sidebar__nav">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="app-sidebar__section">{section.title}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.label} to={item.to} end={item.end} className="nav-link" onClick={onNavigate}>
                  <Icon size={18} aria-hidden="true" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
