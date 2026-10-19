import {
  FileText, GraduationCap, KeyRound, Landmark, LayoutDashboard, Layers, MessageSquareText, NotebookPen, Receipt,
  Settings, TrendingDown, UserCog, UserRound, UserX, Wallet,
} from 'lucide-react';

const ALL_ROLES = ['admin', 'accountant', 'teacher', 'parent'];
const FINANCE = ['admin', 'accountant'];

/**
 * Sidebar structure; each item is shown only to the listed roles.
 * Labels are translation keys: `nav.sections.<section>` and `nav.items.<item>`.
 */
export const NAV_SECTIONS = [
  {
    id: 'overview',
    items: [{ id: 'dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ALL_ROLES, end: true }],
  },
  {
    id: 'academics',
    items: [
      { id: 'students', to: '/students', icon: GraduationCap, roles: ['admin', 'accountant', 'teacher'] },
      { id: 'children', to: '/students', icon: GraduationCap, roles: ['parent'] },
      { id: 'marks', to: '/marks', icon: NotebookPen, roles: ['admin', 'teacher'] },
      { id: 'reports', to: '/reports', icon: FileText, roles: ['admin', 'teacher', 'parent'] },
      { id: 'academics', to: '/academics', icon: Layers, roles: ['admin'] },
    ],
  },
  {
    id: 'finance',
    items: [
      { id: 'finance', to: '/finance', icon: Landmark, roles: FINANCE, end: true },
      { id: 'payments', to: '/finance/payments', icon: Receipt, roles: FINANCE },
      { id: 'defaulters', to: '/finance/defaulters', icon: UserX, roles: FINANCE },
      { id: 'fees', to: '/finance/fees', icon: Wallet, roles: FINANCE },
      { id: 'expenses', to: '/finance/expenses', icon: TrendingDown, roles: FINANCE },
    ],
  },
  {
    id: 'communication',
    items: [{ id: 'sms', to: '/sms', icon: MessageSquareText, roles: FINANCE }],
  },
  {
    id: 'administration',
    items: [
      { id: 'users', to: '/users', icon: UserCog, roles: ['admin'] },
      { id: 'settings', to: '/settings', icon: Settings, roles: ['admin'] },
    ],
  },
  {
    id: 'account',
    items: [
      { id: 'profile', to: '/account', icon: UserRound, roles: ALL_ROLES, end: true },
      { id: 'password', to: '/account/password', icon: KeyRound, roles: ALL_ROLES },
    ],
  },
];
