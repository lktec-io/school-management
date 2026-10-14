import { Award, FileText, GraduationCap, Layers, MessageSquareText, Percent, Settings, TriangleAlert, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { formatMoney, formatNumber, formatPercent } from '../../utils/format.js';
import { StatusBadge } from '../ui/StatusBadge.jsx';
import { ActivityStream, PerformanceCard, Progress, StatTile } from './widgets.jsx';

/** Headmaster portal: school-wide KPIs, class-by-class fees & performance, live audit activity. */
export default function AdminDashboard({ data }) {
  const { metrics, performance, studentsByClass, statusBreakdown, fees, classFinance = [] } = data;
  const sms = useApi('/sms/balance');

  const financeByClass = new Map(classFinance.map((row) => [row.classId, row]));
  const performanceByClass = new Map((performance?.byClass ?? []).map((row) => [row.classId, row]));
  const rows = studentsByClass.map((cls) => ({
    ...cls,
    finance: financeByClass.get(cls.classId),
    results: performanceByClass.get(cls.classId),
  }));

  const smsValue = sms.loading ? '…'
    : sms.data?.creditBalance !== null && sms.data?.creditBalance !== undefined ? formatNumber(sms.data.creditBalance, 0) : '—';

  return (
    <>
      <div className="kpi-grid">
        <StatTile label="Active students" value={formatNumber(metrics.activeStudents, 0)} icon={GraduationCap} mono
          meta={<span className="mono">{metrics.maleStudents} M · {metrics.femaleStudents} F · {metrics.activeClasses} classes</span>} />
        <StatTile label="Collection rate" value={fees?.collectionRate !== null && fees?.collectionRate !== undefined ? formatPercent(fees.collectionRate) : '—'}
          icon={Percent} mono tone={fees?.collectionRate >= 75 ? 'success' : 'warning'}
          meta={fees ? <>{fees.termName} · <span className="mono">TZS {formatMoney(fees.collected)}</span> in</> : 'No current term'} />
        <StatTile label="Total arrears (TZS)" value={fees ? formatMoney(fees.outstanding) : '—'} icon={TriangleAlert} mono tone="danger"
          meta={fees ? <Link to="/finance/defaulters">View defaulters</Link> : null} />
        <StatTile label="Pass rate" value={performance?.passRate !== null && performance?.passRate !== undefined ? formatPercent(performance.passRate) : '—'}
          icon={Award} mono tone={performance?.passRate >= 50 ? 'success' : 'warning'} meta={performance ? performance.exam.name : 'No results yet'} />
        <StatTile label="Beem SMS balance" value={smsValue} icon={MessageSquareText} mono
          meta={sms.data && !sms.data.configured ? 'Gateway not configured' : <Link to="/sms">SMS Center</Link>} />
      </div>

      <div className="finance-split">
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Class-by-class: fee collection &amp; performance</h2>
            <span className="text-xs text-muted">{fees?.termName ?? 'Current term'}{performance ? ` · ${performance.exam.name}` : ''}</span>
          </div>
          <div className="table-wrapper density-compact">
            <table className="data-table class-matrix">
              <thead>
                <tr>
                  <th>Class</th>
                  <th className="numeric">Students</th>
                  <th style={{ width: '24%' }}>Fee collection</th>
                  <th className="numeric">Arrears (TZS)</th>
                  <th style={{ width: '24%' }}>Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={5} className="data-table__empty">No classes configured yet.</td></tr>}
                {rows.map((row) => (
                  <tr key={row.classId}>
                    <td className="data-table__primary">{row.className}</td>
                    <td className="numeric">{row.students}</td>
                    <td>
                      {row.finance ? (
                        <div className="class-matrix__bar">
                          <Progress value={row.finance.collectionRate} label={`${row.className} fee collection`} />
                          <span className="mono text-sm">{formatPercent(row.finance.collectionRate)}</span>
                        </div>
                      ) : <span className="text-muted text-sm">No fees set</span>}
                    </td>
                    <td className="numeric">{row.finance ? formatMoney(row.finance.outstanding) : '—'}</td>
                    <td>
                      {row.results ? (
                        <div className="class-matrix__bar">
                          <Progress value={row.results.passRate} label={`${row.className} pass rate`} />
                          <span className="mono text-sm">{formatPercent(row.results.passRate)}</span>
                        </div>
                      ) : <span className="text-muted text-sm">No results</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <ActivityStream />
      </div>

      <div className="dashboard-grid">
        <PerformanceCard performance={performance} />
        <section className="card">
          <div className="card__header"><h2 className="card__title">School at a glance</h2></div>
          <div className="card__body stack">
            <ul className="status-list">
              {Object.entries(statusBreakdown).length === 0 && <li className="text-muted">No students registered yet.</li>}
              {Object.entries(statusBreakdown).map(([status, total]) => (
                <li key={status}><StatusBadge status={status} /> <span className="mono">{total}</span></li>
              ))}
            </ul>
            <dl className="kv-grid">
              <div><dt>Teaching staff</dt><dd className="mono">{metrics.activeTeachers}</dd></div>
              <div><dt>Subjects offered</dt><dd className="mono">{metrics.activeSubjects}</dd></div>
              <div><dt>Streams</dt><dd className="mono">{metrics.activeStreams}</dd></div>
              <div><dt>Admissions this year</dt><dd className="mono">{metrics.admissionsThisYear}</dd></div>
            </dl>
            <div className="quick-links">
              <Link to="/academics" className="btn btn--outline btn--sm"><Layers size={14} aria-hidden="true" /> Academic setup</Link>
              <Link to="/reports" className="btn btn--outline btn--sm"><FileText size={14} aria-hidden="true" /> Report cards</Link>
              <Link to="/finance" className="btn btn--outline btn--sm"><Wallet size={14} aria-hidden="true" /> Finance</Link>
              <Link to="/users" className="btn btn--outline btn--sm"><Users size={14} aria-hidden="true" /> Users</Link>
              <Link to="/settings" className="btn btn--outline btn--sm"><Settings size={14} aria-hidden="true" /> School settings</Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
