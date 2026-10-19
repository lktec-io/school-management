import { Award, ClipboardCheck, GraduationCap, Layers, NotebookPen, Percent, Sheet, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { SERIES } from '../../utils/charts.js';
import { classLabel, formatPercent } from '../../utils/format.js';
import { EmptyState } from '../ui/Feedback.jsx';
import { ChartCard, TrendChart } from './charts.jsx';
import { BreakdownTable, Progress, StatTile } from './widgets.jsx';

function marksLink(params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== ''));
  return `/marks?${query.toString()}`;
}

/** Teacher portal: KPIs, results charts, pending marks submissions and assigned classes. */
export default function TeacherDashboard({ data }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { metrics, assignedClasses = [], pendingMarks = [], openExams = [], performance, trend = [] } = data;
  const latestOpenExam = openExams[0];

  const hasValue = (value) => value !== null && value !== undefined;

  return (
    <>
      <div className="kpi-grid kpi-grid--three">
        <StatTile label={t('dash.passRate')} value={hasValue(performance?.passRate) ? formatPercent(performance.passRate) : '—'} icon={Award} mono tone="success"
          meta={performance ? performance.exam.name : t('dash.noResults')} />
        <StatTile label={t('dash.totalStudents')} value={metrics.studentsTaught} icon={GraduationCap} mono tone="info" to="/students"
          meta={t('dash.classesCount', { count: metrics.classesTaught })} />
        <StatTile label={t('dash.averageScore')} value={hasValue(performance?.meanAverage) ? formatPercent(performance.meanAverage) : '—'} icon={Percent} mono tone="warning"
          to="/marks" meta={metrics.pendingMarks ? t('dash.pendingCount', { count: metrics.pendingMarks }) : t('dash.allCaughtUp')} />
      </div>

      <div className="chart-grid">
        <ChartCard className="chart-card--wide" title={t('dash.trendTitle')} caption={t('dash.myClasses')}>
          <TrendChart
            data={trend}
            xKey="label"
            percent
            emptyText={t('dash.noResultsHint')}
            lines={[
              { key: 'meanAverage', name: t('dash.averageScore'), color: SERIES.primary },
              { key: 'passRate', name: t('dash.passRate'), color: SERIES.success },
            ]}
            onSelect={(row) => navigate(marksLink({ examId: row.examId, view: 'results' }))}
          />
        </ChartCard>
        <ChartCard title={t('dash.breakdownTitle')} caption={performance ? performance.exam.name : null}>
          <BreakdownTable performance={performance} />
        </ChartCard>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">{t('dash.pendingSubmissions')}</h2>
          <Link to="/marks" className="btn btn--primary btn--sm"><NotebookPen size={14} aria-hidden="true" /> {t('nav.items.marks')}</Link>
        </div>
        {pendingMarks.length === 0 ? (
          <div className="card__body">
            <EmptyState icon={ClipboardCheck} title={t('dash.allCaughtUp')} message={openExams.length ? t('dash.allEntered') : t('dash.noExamsOpenLong')} />
          </div>
        ) : (
          <div className="table-wrapper density-compact">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('dash.exam')}</th><th>{t('common.class')}</th><th>{t('common.subject')}</th>
                  <th style={{ width: '28%' }}>{t('dash.progress')}</th><th className="actions"><span className="sr-only">{t('dash.enter')}</span></th>
                </tr>
              </thead>
              <tbody>
                {pendingMarks.map((row) => {
                  const pct = row.expected ? (row.entered / row.expected) * 100 : 0;
                  return (
                    <tr key={`${row.examId}-${row.classId}-${row.streamId ?? 0}-${row.subjectId}`}>
                      <td className="data-table__primary">{row.examName}</td>
                      <td>{classLabel(row.className, row.streamName)}{!row.streamName && <span className="text-xs text-muted"> ({t('dash.allStreams')})</span>}</td>
                      <td>{row.subjectName}</td>
                      <td>
                        <div className="class-matrix__bar">
                          <Progress value={pct} label={`${row.subjectName} ${t('dash.marksEntered')}`} />
                          <span className="mono text-xs">{row.entered}/{row.expected}</span>
                        </div>
                      </td>
                      <td className="actions">
                        <Link className="btn btn--outline btn--sm" to={marksLink({ examId: row.examId, classId: row.classId, streamId: row.streamId, subjectId: row.subjectId })}>
                          {t('dash.enter')} <span className="mono">{row.pending}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">{t('dash.myClasses')}</h2>
        {assignedClasses.length === 0 ? (
          <EmptyState icon={Layers} title={t('dash.noClassesAssigned')} message={t('dash.noClassesAssignedHint')} />
        ) : (
          <div className="class-grid">
            {assignedClasses.map((cls) => (
              <article key={`${cls.classId}-${cls.streamId ?? 0}`} className="class-card">
                <div className="split-row">
                  <h3 className="class-card__title">{classLabel(cls.className, cls.streamName)}</h3>
                  <span className="mono text-sm"><Users size={13} aria-hidden="true" className="inline-icon" />{cls.students}</span>
                </div>
                {cls.isClassTeacher && <span className="badge badge--info class-card__tag">{t('dash.classTeacher')}</span>}
                <div className="chip-list">
                  {cls.subjects.map((subject) => <span key={subject.subjectId} className="chip" title={subject.name}>{subject.code}</span>)}
                </div>
                <div className="class-card__actions">
                  <Link className="btn btn--ghost btn--sm" to={`/students?classId=${cls.classId}${cls.streamId ? `&streamId=${cls.streamId}` : ''}`}>
                    <GraduationCap size={14} aria-hidden="true" /> {t('dash.students')}
                  </Link>
                  <Link className="btn btn--ghost btn--sm"
                    to={marksLink({ examId: latestOpenExam?.id, classId: cls.classId, streamId: cls.streamId, subjectId: cls.subjects[0]?.subjectId, view: 'results' })}>
                    <Sheet size={14} aria-hidden="true" /> {t('dash.broadsheet')}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
