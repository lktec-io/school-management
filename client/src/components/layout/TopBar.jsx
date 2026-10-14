import { CalendarDays, ChevronDown, KeyRound, LogOut, Menu, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAcademicPeriod } from '../../context/AcademicContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSchoolProfile } from '../../hooks/useSchoolProfile.js';
import { ROLE_LABELS } from '../../utils/format.js';
import Crest from './Crest.jsx';

function initialsOf(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function TermBadge() {
  const { academicYear, term, loaded } = useAcademicPeriod();
  if (!loaded) return null;
  if (!academicYear || !term) {
    return (
      <span className="term-badge term-badge--warning" title="The Headmaster has not set the current term">
        <TriangleAlert size={14} aria-hidden="true" /> No active term
      </span>
    );
  }
  return (
    <span className="term-badge" title={`Current term: ${term.termName}, ${academicYear.yearLabel}`}>
      <CalendarDays size={14} aria-hidden="true" />
      <span>{term.termName}</span>
      <span className="term-badge__year mono">{academicYear.yearLabel}</span>
    </span>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="user-menu__avatar" aria-hidden="true">{initialsOf(user.fullName)}</span>
        <span className="user-menu__identity">
          <span className="user-menu__name">{user.fullName}</span>
          <span className="user-menu__role">{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="user-menu__dropdown" role="menu">
          <div className="user-menu__header">
            <span className="user-menu__name">{user.fullName}</span>
            <span className="text-xs text-muted">{user.email || user.phone}</span>
          </div>
          <Link to="/account/password" className="user-menu__item" role="menuitem" onClick={() => setOpen(false)}>
            <KeyRound size={16} aria-hidden="true" /> Change password
          </Link>
          <button type="button" className="user-menu__item user-menu__item--danger" role="menuitem" onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function TopBar({ onToggleSidebar }) {
  const school = useSchoolProfile();
  return (
    <header className="app-topbar">
      <div className="app-topbar__left">
        <button type="button" className="btn btn--ghost btn--icon app-topbar__menu" onClick={onToggleSidebar} aria-label="Toggle navigation">
          <Menu size={20} />
        </button>
        <Crest name={school?.name || ''} size={34} logoSrc={school?.logoSrc} />
        <div className="app-topbar__title">
          <span className="app-topbar__school">{school?.name || 'School Portal'}</span>
          {school?.motto && <span className="app-topbar__motto">{school.motto}</span>}
        </div>
      </div>
      <div className="app-topbar__right">
        <TermBadge />
        <UserMenu />
      </div>
    </header>
  );
}
