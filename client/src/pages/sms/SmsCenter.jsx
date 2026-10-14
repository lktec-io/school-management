import { History, MessageSquareText, Send } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { useApi } from '../../hooks/useApi.js';
import { formatNumber } from '../../utils/format.js';
import BroadcastPanel from './BroadcastPanel.jsx';
import SmsLogsPanel from './SmsLogsPanel.jsx';

const TABS = [
  { id: 'broadcast', label: 'Broadcast SMS', icon: Send },
  { id: 'logs', label: 'Delivery logs', icon: History },
];

export default function SmsCenter() {
  const [params, setParams] = useSearchParams();
  const active = params.get('tab') === 'logs' ? 'logs' : 'broadcast';
  const batchId = params.get('batch') || undefined;
  const balance = useApi('/sms/balance');

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Communication"
        title="SMS Center"
        subtitle="Send announcements, fee reminders and results to parents through Beem Africa."
        actions={(
          <span className="balance-pill" title="Live Beem Africa credit balance">
            <MessageSquareText size={16} aria-hidden="true" />
            {balance.loading ? 'Checking balance…' : balance.data?.configured === false ? 'Gateway not configured'
              : balance.data?.creditBalance !== null && balance.data?.creditBalance !== undefined
                ? <><span className="mono">{formatNumber(balance.data.creditBalance, 0)}</span> credits</>
                : 'Balance unavailable'}
          </span>
        )}
      />
      <Tabs tabs={TABS} active={active} label="SMS sections" onChange={(id) => setParams({ tab: id }, { replace: true })} />
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {active === 'broadcast'
          ? <BroadcastPanel onSent={(id) => { setParams({ tab: 'logs', batch: id }, { replace: true }); balance.reload(); }} />
          : <SmsLogsPanel batchId={batchId} onClearBatch={() => setParams({ tab: 'logs' }, { replace: true })} />}
      </div>
    </div>
  );
}
