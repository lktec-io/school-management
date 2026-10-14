import { BookOpen, ClipboardCheck, GraduationCap, Layers, NotebookPen, Sheet, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { classLabel } from '../../utils/format.js';
import { EmptyState } from '../ui/Feedback.jsx';
import { PerformanceCard, Progress, StatTile } from './widgets.jsx';

function marksLink(params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== ''));
  return `/marks?${query.toString()}`;
}

/** Teacher portal: assigned classes grid, pending marks submissions, quick links. */
export default function TeacherDashboard({ data }) {
  const { metrics, assignedClasses = [], pendingMarks = [], openExams = [], performance } = data;
  const latestOpenExam = openExams[0];

  return (
    <>
      <div className="kpi-grid">
        <StatTile label="Classes taught" value={metrics.classesTaught} icon={Layers} mono />
        <StatTile label="Students" value={metrics.studentsTaught} icon={GraduationCap} mono />
        <StatTile label="Subject assignments" value={metrics.subjectAssignments} icon={BookOpen} mono />
        <StatTile label="Marks pending" value={metrics.pendingMarks} icon={ClipboardCheck} mono tone={metrics.pendingMarks ? 'warning' : 'success'}
          meta={openExams.length ? `${openExams.length} exam(s) open for entry` : 'No exams open'} />
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Pending marks submissions</h2>
          <Link to="/marks" className="btn btn--primary btn--sm"><NotebookPen size={14} aria-hidden="true" /> Marks entry</Link>
        </div>
        {pendingMarks.length === 0 ? (
          <div className="card__body">
            <EmptyState icon={ClipboardCheck} title="All caught up" message={openExams.length ? 'Every mark for your open exams has been entered.' : 'No examinations are open for marks entry.'} />
          </div>
        ) : (
          <div className="table-wrapper density-compact">
            <table className="data-table">
              <thead><tr><th>Examination</th><th>Class</th><th>Subject</th><th style={{ width: '28%' }}>Progress</th><th className="actions"><span className="sr-only">Enter</span></th></tr></thead>
              <tbody>
                {pendingMarks.map((row) => {
                  const pct = row.expected ? (row.entered / row.expected) * 100 : 0;
                  return (
                    <tr key={`${row.examId}-${row.classId}-${row.streamId ?? 0}-${row.subjectId}`}>
                      <td className="data-table__primary">{row.examName}</td>
                      <td>{classLabel(row.className, row.streamName)}{!row.streamName && <span className="text-xs text-muted"> (all streams)</span>}</td>
                      <td>{row.subjectName}</td>
                      <td>
                        <div className="class-matrix__bar">
                          <Progress value={pct} label={`${row.subjectName} marks entered`} />
                          <span className="mono text-xs">{row.entered}/{row.expected}</span>
                        </div>
                      </td>
                      <td className="actions">
                        <Link className="btn btn--outline btn--sm" to={marksLink({ examId: row.examId, classId: row.classId, streamId: row.streamId, subjectId: row.subjectId })}>
                          Enter <span className="mono">{row.pending}</span>
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
        <h2 className="section-title">My classes</h2>
        {assignedClasses.length === 0 ? (
          <EmptyState icon={Layers} title="No classes assigned" message="Ask the Headmaster to assign your subjects for the current academic year." />
        ) : (
          <div className="class-grid">
            {assignedClasses.map((cls) => (
              <article key={`${cls.classId}-${cls.streamId ?? 0}`} className={`class-card${cls.isClassTeacher ? ' class-card--teacher' : ''}`}>
                <div className="split-row">
                  <h3 className="class-card__title">{classLabel(cls.className, cls.streamName)}</h3>
                  <span className="mono text-sm"><Users size={13} aria-hidden="true" className="inline-icon" />{cls.students}</span>
                </div>
                {cls.isClassTeacher && <span className="eyebrow">Class teacher</span>}
                <div className="chip-list">
                  {cls.subjects.map((subject) => <span key={subject.subjectId} className="chip" title={subject.name}>{subject.code}</span>)}
                </div>
                <div className="class-card__actions">
                  <Link className="btn btn--ghost btn--sm" to={`/students?classId=${cls.classId}${cls.streamId ? `&streamId=${cls.streamId}` : ''}`}>
                    <GraduationCap size={14} aria-hidden="true" /> Students
                  </Link>
                  <Link className="btn btn--ghost btn--sm"
                    to={marksLink({ examId: latestOpenExam?.id, classId: cls.classId, streamId: cls.streamId, subjectId: cls.subjects[0]?.subjectId, view: 'results' })}>
                    <Sheet size={14} aria-hidden="true" /> Broadsheet
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <PerformanceCard performance={performance} title="My classes — latest results" />
    </>
  );
}
