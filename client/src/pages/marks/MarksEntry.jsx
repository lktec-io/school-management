import { Award, ClipboardList, NotebookPen } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorBlock, InlineAlert, LoadingBlock } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { GradeChip, StatusBadge } from '../../components/ui/StatusBadge.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useState } from 'react';
import { EXAM_TYPE_LABELS, LEVEL_LABELS, formatNumber } from '../../utils/format.js';
import ClassResults from './ClassResults.jsx';
import MarksGrid from './MarksGrid.jsx';

const VIEWS = [
  { id: 'entry', label: 'Enter marks', icon: NotebookPen },
  { id: 'results', label: 'Class results & rankings', icon: Award },
];

function SaveSummary({ summary }) {
  if (!summary) return null;
  return (
    <InlineAlert tone="success" title={`${summary.name}: results recalculated`} icon={Award}>
      <p className="distribution">
        <span>Candidates <strong className="mono">{summary.candidates}</strong></span>
        <span>Mean <strong className="mono">{formatNumber(summary.meanPct)}%</strong></span>
        <span>Highest <strong className="mono">{formatNumber(summary.highestPct)}%</strong></span>
        <span>Lowest <strong className="mono">{formatNumber(summary.lowestPct)}%</strong></span>
        {Object.entries(summary.gradeDistribution).sort().map(([grade, count]) => (
          <span key={grade}><GradeChip grade={grade} /> <span className="mono">{count}</span></span>
        ))}
      </p>
    </InlineAlert>
  );
}

export default function MarksEntry() {
  const { hasRole } = useAuth();
  const isTeacher = hasRole('teacher');
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(() => (params.get('view') === 'results' ? 'results' : 'entry'));
  const [lastSummary, setLastSummary] = useState(null);

  const selection = {
    examId: params.get('examId') || '',
    classId: params.get('classId') || '',
    streamId: params.get('streamId') || '',
    subjectId: params.get('subjectId') || '',
  };

  const exams = useApi('/exams');
  const markable = (exams.data ?? []).filter((exam) => exam.status !== 'draft');
  const defaultExam = markable.find((exam) => exam.status === 'open') ?? markable[0];
  const examId = selection.examId || (defaultExam ? String(defaultExam.id) : '');
  const exam = markable.find((item) => String(item.id) === examId);

  const assignments = useApi(isTeacher ? '/academics/assignments' : null);
  const classes = useApi(isTeacher ? null : '/academics/classes');
  const selectedClass = (classes.data ?? []).find((cls) => String(cls.id) === selection.classId);
  const subjects = useApi(!isTeacher && selectedClass ? '/academics/subjects' : null, { level: selectedClass?.level });

  const ready = Boolean(examId && selection.classId && selection.subjectId);
  const sheet = useApi(ready ? `/exams/${examId}/marksheet` : null, {
    classId: selection.classId,
    streamId: selection.streamId,
    subjectId: selection.subjectId,
  });

  const select = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
    setLastSummary(null);
  };

  const assignmentKey = `${selection.classId}|${selection.streamId}|${selection.subjectId}`;

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Examinations"
        title="Marks entry"
        subtitle="Select an examination and class, then enter scores. Grades, totals, averages and positions update automatically."
      />

      <div className="filter-bar card">
        <label className="filter-bar__field">
          <span className="eyebrow">Examination</span>
          <select className="form-control" value={examId} onChange={(event) => select({ examId: event.target.value })}>
            {markable.length === 0 && <option value="">No examinations available</option>}
            {markable.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {item.termName} {item.yearLabel} ({item.status})
              </option>
            ))}
          </select>
        </label>

        {isTeacher ? (
          <label className="filter-bar__field filter-bar__field--wide">
            <span className="eyebrow">My class &amp; subject</span>
            <select
              className="form-control"
              value={assignmentKey}
              onChange={(event) => {
                const [classId, streamId, subjectId] = event.target.value.split('|');
                select({ classId, streamId, subjectId });
              }}
            >
              <option value="||">Select an assignment…</option>
              {(assignments.data ?? []).map((assignment) => (
                <option key={assignment.id} value={`${assignment.classId}|${assignment.streamId ?? ''}|${assignment.subjectId}`}>
                  {assignment.className}{assignment.streamName ? ` ${assignment.streamName}` : ' (all streams)'} — {assignment.subjectName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="filter-bar__field">
              <span className="eyebrow">Class</span>
              <select className="form-control" value={selection.classId} onChange={(event) => select({ classId: event.target.value, streamId: '', subjectId: '' })}>
                <option value="">Select class…</option>
                {(classes.data ?? []).map((cls) => <option key={cls.id} value={cls.id}>{cls.className} · {LEVEL_LABELS[cls.level]}</option>)}
              </select>
            </label>
            <label className="filter-bar__field">
              <span className="eyebrow">Stream</span>
              <select className="form-control" value={selection.streamId} onChange={(event) => select({ streamId: event.target.value })} disabled={!selectedClass?.streams.length}>
                <option value="">All streams</option>
                {(selectedClass?.streams ?? []).map((stream) => <option key={stream.id} value={stream.id}>Stream {stream.streamName}</option>)}
              </select>
            </label>
            <label className="filter-bar__field">
              <span className="eyebrow">Subject</span>
              <select className="form-control" value={selection.subjectId} onChange={(event) => select({ subjectId: event.target.value })} disabled={!selectedClass}>
                <option value="">Select subject…</option>
                {(subjects.data ?? []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}
              </select>
            </label>
          </>
        )}
      </div>

      {exam && (
        <p className="text-sm text-muted exam-context">
          <ClipboardList size={14} aria-hidden="true" className="inline-icon" />
          {EXAM_TYPE_LABELS[exam.examType]} · {exam.termName} {exam.yearLabel} · <StatusBadge status={exam.status} />
        </p>
      )}

      {isTeacher && assignments.data?.length === 0 && (
        <InlineAlert tone="warning" title="No teaching assignments">
          <p>You have not been assigned any subjects for the current academic year. Contact the Headmaster.</p>
        </InlineAlert>
      )}
      <ErrorBlock error={exams.error} onRetry={exams.reload} />

      {selection.classId && examId && (
        <Tabs tabs={VIEWS} active={view} onChange={setView} label="Marks views" />
      )}

      {view === 'entry' && (
        <div role="tabpanel" id="panel-entry" aria-labelledby="tab-entry" className="stack">
          {!ready && (
            <EmptyState icon={NotebookPen} title="Choose what to mark" message="Select an examination, class and subject to load the marksheet." />
          )}
          {ready && sheet.loading && !sheet.data && <LoadingBlock label="Loading marksheet…" />}
          {ready && <ErrorBlock error={sheet.error} onRetry={sheet.reload} />}
          <SaveSummary summary={lastSummary} />
          {ready && sheet.data && (
            <MarksGrid
              sheet={sheet.data}
              onSaved={(result) => {
                setLastSummary(result.subjectSummary);
                sheet.reload();
              }}
            />
          )}
        </div>
      )}

      {view === 'results' && selection.classId && examId && (
        <div role="tabpanel" id="panel-results" aria-labelledby="tab-results">
          <ClassResults examId={examId} classId={selection.classId} streamId={selection.streamId} />
        </div>
      )}
    </div>
  );
}
