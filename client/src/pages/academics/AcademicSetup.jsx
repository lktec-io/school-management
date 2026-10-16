import { BookOpen, CalendarDays, ClipboardList, Layers, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import AssignmentsPanel from './AssignmentsPanel.jsx';
import CalendarPanel from './CalendarPanel.jsx';
import ClassesPanel from './ClassesPanel.jsx';
import ExamsPanel from './ExamsPanel.jsx';
import SubjectsPanel from './SubjectsPanel.jsx';
import { useTranslation } from 'react-i18next';

const TABS = [
  { id: 'calendar', label: 'Calendar & Terms', icon: CalendarDays, Panel: CalendarPanel },
  { id: 'classes', label: 'Classes & Streams', icon: Layers, Panel: ClassesPanel },
  { id: 'subjects', label: 'Subjects', icon: BookOpen, Panel: SubjectsPanel },
  { id: 'assignments', label: 'Teacher Assignments', icon: Users, Panel: AssignmentsPanel },
  { id: 'exams', label: 'Examinations', icon: ClipboardList, Panel: ExamsPanel },
];

export default function AcademicSetup() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const active = TABS.find((tab) => tab.id === params.get('tab')) ?? TABS[0];
  const { Panel } = active;

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={t('pages.academics.eyebrow')}
        title={t('pages.academics.title')}
        subtitle={t('pages.academics.subtitle')}
      />
      <Tabs
        tabs={TABS}
        active={active.id}
        label="Academic setup sections"
        onChange={(id) => setParams({ tab: id }, { replace: true })}
      />
      <div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`}>
        <Panel key={active.id} />
      </div>
    </div>
  );
}
