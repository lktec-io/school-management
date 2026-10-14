import Crest from '../../components/layout/Crest.jsx';
import { useSchoolProfile } from '../../hooks/useSchoolProfile.js';
import { GradeChip } from '../../components/ui/StatusBadge.jsx';
import { classLabel, formatNumber } from '../../utils/format.js';

/** On-screen replica of the official PDF report card. */
export default function ReportCardPaper({ card }) {
  const { school, exam, student, result, gradingScale, remarks, level, classTeacherName } = card;
  const logoSrc = useSchoolProfile()?.logoSrc;
  const showPoints = level === 'o_level' || level === 'a_level';
  const overall = result?.overall;

  return (
    <article className="report-paper" aria-label={`Report card for ${student.fullName}`}>
      <header className="report-paper__header">
        <Crest name={school.name} size={64} logoSrc={logoSrc} />
        <div className="report-paper__school">
          <h2>{school.name}</h2>
          {school.address && <p>{school.address}</p>}
          {(school.phone || school.email) && <p>{[school.phone && `Tel: ${school.phone}`, school.email && `Email: ${school.email}`].filter(Boolean).join('  |  ')}</p>}
          {school.registrationNo && <p>Registration No: <span className="mono">{school.registrationNo}</span></p>}
          {school.motto && <p className="report-paper__motto">“{school.motto}”</p>}
        </div>
      </header>

      <div className="report-paper__title">
        <strong>Student Academic Progress Report</strong>
        <span>{exam.name} · {exam.termName} · Academic Year <span className="mono">{exam.yearLabel}</span></span>
      </div>

      <dl className="report-paper__info">
        <div><dt>Registration No.</dt><dd className="reg-no">{student.registrationNumber}</dd></div>
        <div className="span-2"><dt>Student name</dt><dd>{student.fullName.toUpperCase()}</dd></div>
        <div><dt>Gender</dt><dd>{student.gender === 'male' ? 'Male' : 'Female'}</dd></div>
        <div><dt>Class / Stream</dt><dd>{classLabel(student.className, student.streamName)}</dd></div>
        <div><dt>Position in class</dt><dd className="mono">{result?.classPosition ? `${result.classPosition} of ${result.classSize}` : '—'}</dd></div>
        <div><dt>Position in stream</dt><dd className="mono">{result?.streamPosition && student.streamName ? `${result.streamPosition} of ${result.streamSize}` : '—'}</dd></div>
        <div><dt>Total students</dt><dd className="mono">{result?.classSize ?? '—'}</dd></div>
      </dl>

      <table className="report-paper__marks">
        <thead>
          <tr>
            <th>#</th><th>Subject</th><th className="numeric">Marks</th><th className="numeric">%</th>
            <th className="center">Grade</th>{showPoints && <th className="numeric">Points</th>}<th>Remarks</th><th>Subject teacher</th>
          </tr>
        </thead>
        <tbody>
          {(result?.subjects ?? []).map((subject, index) => (
            <tr key={subject.subjectId}>
              <td className="mono">{index + 1}</td>
              <td>{subject.name}</td>
              <td className="numeric">{subject.isAbsent ? 'ABS' : formatNumber(subject.score)}</td>
              <td className="numeric">{subject.isAbsent ? '—' : formatNumber(subject.percentage, 1)}</td>
              <td className="center"><GradeChip grade={subject.grade} /></td>
              {showPoints && <td className="numeric">{subject.points ?? '—'}</td>}
              <td>{subject.teacherRemark || subject.remark}</td>
              <td>{subject.teacherName || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="report-paper__summary">
        <dl className="report-paper__totals">
          <div><dt>Total marks</dt><dd className="mono">{result ? `${formatNumber(result.totalScore)} / ${formatNumber(result.maxPossible)}` : '—'}</dd></div>
          <div><dt>Average score</dt><dd className="mono">{result?.averagePct !== null && result?.averagePct !== undefined ? `${formatNumber(result.averagePct)}%` : '—'}</dd></div>
          <div><dt>Average grade</dt><dd><GradeChip grade={overall?.averageGrade} /></dd></div>
          <div>
            <dt>{overall?.type === 'division' ? `Division (best ${overall.bestOf})` : 'Overall grade'}</dt>
            <dd><GradeChip grade={overall?.value} />{overall?.points !== null && overall?.points !== undefined && <span className="mono"> ({overall.points} pts)</span>}</dd>
          </div>
          <div><dt>Overall remark</dt><dd><strong>{overall?.remark ?? '—'}</strong></dd></div>
          <div><dt>Subjects sat</dt><dd className="mono">{result?.subjectsSat ?? '—'}</dd></div>
        </dl>
        <div className="report-paper__key">
          <div className="eyebrow">Grading key</div>
          <ul>
            {gradingScale.map((band) => (
              <li key={band.grade}><GradeChip grade={band.grade} /> <span className="mono">{band.range}</span> <span className="text-muted">{band.remark}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="report-paper__remarks">
        <div>
          <div className="eyebrow">Class teacher&apos;s remarks</div>
          <p>{remarks.classTeacherRemark || <span className="text-muted">—</span>}</p>
          <span className="report-paper__signature">Signature — {classTeacherName || 'Class teacher'}</span>
        </div>
        <div>
          <div className="eyebrow">Headmaster&apos;s remarks</div>
          <p>{remarks.headmasterRemark || <span className="text-muted">—</span>}</p>
          <span className="report-paper__signature">Signature — Headmaster</span>
        </div>
      </div>
    </article>
  );
}
