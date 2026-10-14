import {
  FileText, GraduationCap, KeyRound, Landmark, LayoutDashboard, Layers, MessageSquareText, NotebookPen, Receipt,
  Settings, ShieldCheck, TrendingDown, UserCog, UserX, Wallet,
} from 'lucide-react';

const ALL_ROLES = ['admin', 'accountant', 'teacher', 'parent'];
const FINANCE = ['admin', 'accountant'];

/** Sidebar structure; each item is shown only to the listed roles. */
export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL_ROLES, end: true }],
  },
  {
    title: 'Academics',
    items: [
      { to: '/students', label: 'Students', icon: GraduationCap, roles: ['admin', 'accountant', 'teacher'] },
      { to: '/students', label: 'My Children', icon: GraduationCap, roles: ['parent'] },
      { to: '/marks', label: 'Marks Entry', icon: NotebookPen, roles: ['admin', 'teacher'] },
      { to: '/reports', label: 'Report Cards', icon: FileText, roles: ['admin', 'teacher', 'parent'] },
      { to: '/academics', label: 'Academic Setup', icon: Layers, roles: ['admin'] },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/finance', label: 'Finance Overview', icon: Landmark, roles: FINANCE, end: true },
      { to: '/finance/payments', label: 'Payments', icon: Receipt, roles: FINANCE },
      { to: '/finance/defaulters', label: 'Fee Defaulters', icon: UserX, roles: FINANCE },
      { to: '/finance/fees', label: 'Fee Setup', icon: Wallet, roles: FINANCE },
      { to: '/finance/expenses', label: 'Expenses', icon: TrendingDown, roles: FINANCE },
    ],
  },
  {
    title: 'Communication',
    items: [{ to: '/sms', label: 'SMS Center', icon: MessageSquareText, roles: FINANCE }],
  },
  {
    title: 'Administration',
    items: [
      { to: '/users', label: 'User Accounts', icon: UserCog, roles: ['admin'] },
      { to: '/audit', label: 'Audit Trail', icon: ShieldCheck, roles: ['admin'] },
      { to: '/settings', label: 'School Settings', icon: Settings, roles: ['admin'] },
    ],
  },
  {
    title: 'My Account',
    items: [{ to: '/account/password', label: 'Change Password', icon: KeyRound, roles: ALL_ROLES }],
  },
];
