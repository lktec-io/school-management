import { Award } from 'lucide-react';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { GradeChip } from '../../components/ui/StatusBadge.jsx';
import { useApi } from '../../hooks/useApi.js';
import { formatNumber, formatPercent } from '../../utils/format.js';

/** Class broadsheet: per-subject grades, totals, averages, division and RANK() positions. */
export default function ClassResults({ examId, classId, streamId }) {
  const { data, error, loading, reload } = useApi(`/exams/${examId}/results`, { classId, streamId });

  if (loading && !data) return <LoadingBlock label="Calculating results…" />;
  if (error) return <ErrorBlock error={error} onRetry={reload} />;
  if (!data) return null;
  if (data.students.length === 0) {
    return <EmptyState icon={Award} title="No results yet" message="Results are calculated automatically as marks are entered." />;
  }

  const { statistics, subjects, students } = data;
  const isDivision = students[0]?.overall.type === 'division';

  return (
    <div className="stack">
      <div className="stat-grid stat-grid--compact">
        <div className="stat-tile"><div className="stat-tile__label">Candidates ranked</div><div className="stat-tile__value mono">{statistics.ranked}</div></div>
        <div className="stat-tile"><div className="stat-tile__label">Class mean</div><div className="stat-tile__value mono">{formatPercent(statistics.meanAverage, 2)}</div></div>
        <div className={`stat-tile ${statistics.passRate >= 50 ? 'stat-tile--success' : 'stat-tile--danger'}`}>
          <div className="stat-tile__label">Pass rate</div><div className="stat-tile__value mono">{formatPercent(statistics.passRate)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__label">{isDivision ? 'Divisions' : 'Overall grades'}</div>
          <div className="distribution">
            {Object.entries(statistics.overallDistribution).map(([key, count]) => (
              <span key={key}><GradeChip grade={key} /> <span className="mono">{count}</span></span>
            ))}
          </div>
        </div>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Class broadsheet — {data.class.className}</h2>
          <span className="text-sm text-muted">Positions are ranked across the whole class by average, then total.</span>
        </div>
        <div className="table-wrapper density-compact broadsheet">
          <table className="data-table">
            <thead>
              <tr>
                <th className="numeric">Pos.</th>
                <th>Reg. No</th>
                <th>Student</th>
                <th>Stream</th>
                {subjects.map((subject) => <th key={subject.subjectId} className="center" title={subject.name}>{subject.code}</th>)}
                <th className="numeric">Total</th>
                <th className="numeric">Avg %</th>
                <th className="center">Grade</th>
                {isDivision && <th className="center">Div.</th>}
                {isDivision && <th className="numeric">Pts</th>}
                <th>Remark</th>
                <th className="numeric">Stream pos.</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const bySubject = new Map(student.subjects.map((subject) => [subject.subjectId, subject]));
                return (
                  <tr key={student.studentId}>
                    <td className="numeric"><strong>{student.classPosition ?? '—'}</strong></td>
                    <td><span className="reg-no">{student.registrationNumber}</span></td>
                    <td className="data-table__primary text-nowrap">{student.fullName}</td>
                    <td>{student.streamName || '—'}</td>
                    {subjects.map((subject) => {
                      const entry = bySubject.get(subject.subjectId);
                      return (
                        <td key={subject.subjectId} className="center text-nowrap">
                          {entry ? (
                            <span className="broadsheet__cell">
                              <span className="mono">{entry.isAbsent ? '' : formatNumber(entry.score)}</span>
                              <GradeChip grade={entry.grade} />
                            </span>
                          ) : <span className="text-muted">—</span>}
                        </td>
                      );
                    })}
                    <td className="numeric">{formatNumber(student.totalScore)}</td>
                    <td className="numeric">{formatNumber(student.averagePct)}</td>
                    <td className="center"><GradeChip grade={student.overall.averageGrade} /></td>
                    {isDivision && <td className="center"><GradeChip grade={student.overall.value} /></td>}
                    {isDivision && <td className="numeric">{student.overall.points ?? '—'}</td>}
                    <td>{student.overall.remark ?? '—'}</td>
                    <td className="numeric">{student.streamPosition ? `${student.streamPosition}/${student.streamSize}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card__header"><h2 className="card__title">Subject analysis</h2></div>
        <div className="table-wrapper density-compact">
          <table className="data-table">
            <thead>
              <tr>
                <th>Subject</th><th className="numeric">Candidates</th><th className="numeric">Mean %</th>
                <th className="numeric">Highest %</th><th className="numeric">Lowest %</th><th>Grade distribution</th>
              </tr>
            </thead>
            <tbody>
              {statistics.subjects.map((subject) => (
                <tr key={subject.subjectId}>
                  <td><span className="data-table__primary">{subject.name}</span> <span className="mono text-xs text-muted">{subject.code}</span></td>
                  <td className="numeric">{subject.candidates}</td>
                  <td className="numeric">{formatNumber(subject.meanPct)}</td>
                  <td className="numeric">{formatNumber(subject.highestPct)}</td>
                  <td className="numeric">{formatNumber(subject.lowestPct)}</td>
                  <td>
                    <div className="distribution">
                      {Object.entries(subject.gradeDistribution).sort().map(([grade, count]) => (
                        <span key={grade}><GradeChip grade={grade} /> <span className="mono">{count}</span></span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
