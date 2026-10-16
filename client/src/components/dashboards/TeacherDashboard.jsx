import { BookOpen, ClipboardCheck, GraduationCap, Layers, NotebookPen, Sheet, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { SERIES } from '../../utils/charts.js';
import { classLabel } from '../../utils/format.js';
import { EmptyState } from '../ui/Feedback.jsx';
import { BarChartCard, ChartCard, DonutChart } from './charts.jsx';
import { Progress, StatTile } from './widgets.jsx';

function marksLink(params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== ''));
  return `/marks?${query.toString()}`;
}

/** Teacher portal: KPIs, results charts, pending marks submissions and assigned classes. */
export default function TeacherDashboard({ data }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { metrics, assignedClasses = [], pendingMarks = [], openExams = [], performance } = data;
  const latestOpenExam = openExams[0];

  const totalExpected = pendingMarks.reduce((sum, row) => sum + row.expected, 0);
  const totalEntered = pendingMarks.reduce((sum, row) => sum + row.entered, 0);
  const marksData = [
    { key: 'entered', name: t('dash.marksEntered'), value: totalEntered, color: SERIES.success },
    { key: 'pending', name: t('dash.marksPending'), value: Math.max(0, totalExpected - totalEntered), color: SERIES.accent },
  ];

  return (
    <>
      <div className="kpi-grid">
        <StatTile label={t('dash.classesTaught')} value={metrics.classesTaught} icon={Layers} mono />
        <StatTile label={t('dash.students')} value={metrics.studentsTaught} icon={GraduationCap} mono to="/students" />
        <StatTile label={t('dash.subjectAssignments')} value={metrics.subjectAssignments} icon={BookOpen} mono />
        <StatTile label={t('dash.marksPending')} value={metrics.pendingMarks} icon={ClipboardCheck} mono to="/marks"
          tone={metrics.pendingMarks ? 'warning' : 'success'}
          meta={openExams.length ? t('dash.examsOpen', { count: openExams.length }) : t('dash.noExamsOpen')} />
      </div>

      <div className="chart-grid">
        <ChartCard className="chart-card--wide" title={t('dash.myResults')}
          caption={performance ? `${performance.exam.name} · ${t('charts.clickBar')}` : null}>
          <BarChartCard
            data={performance?.byClass ?? []}
            xKey="className"
            bars={[
              { key: 'passRate', name: t('dash.passRate'), color: SERIES.primary },
              { key: 'meanAverage', name: t('dash.meanPercent'), color: SERIES.accent },
            ]}
            onSelect={(row) => navigate(marksLink({ examId: performance.exam.id, classId: row.classId, view: 'results' }))}
          />
        </ChartCard>
        <ChartCard title={t('dash.marksProgress')} caption={openExams.length ? openExams[0].name : t('dash.noExamsOpen')}>
          <DonutChart data={marksData} centerLabel={t('dash.marks')} onSelect={() => navigate('/marks')} />
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
