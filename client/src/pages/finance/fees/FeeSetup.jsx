import { BadgePercent, Layers, Tags } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader.jsx';
import Tabs from '../../../components/ui/Tabs.jsx';
import DiscountsPanel from './DiscountsPanel.jsx';
import FeeTypesPanel from './FeeTypesPanel.jsx';
import StructuresPanel from './StructuresPanel.jsx';

const TABS = [
  { id: 'structures', label: 'Fee structures', icon: Layers, Panel: StructuresPanel },
  { id: 'types', label: 'Fee types', icon: Tags, Panel: FeeTypesPanel },
  { id: 'discounts', label: 'Discounts & waivers', icon: BadgePercent, Panel: DiscountsPanel },
];

export default function FeeSetup() {
  const [params, setParams] = useSearchParams();
  const active = TABS.find((tab) => tab.id === params.get('tab')) ?? TABS[0];
  const { Panel } = active;
  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Finance" title="Fee setup" subtitle="What each class pays per term, optional items, and approved waivers." />
      <Tabs tabs={TABS} active={active.id} label="Fee setup sections" onChange={(id) => setParams({ tab: id }, { replace: true })} />
      <div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`}>
        <Panel key={active.id} />
      </div>
    </div>
  );
}
