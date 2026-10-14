import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { classLabel } from '../../utils/format.js';

/** Type-ahead student finder (name or registration number). Calls onSelect(student). */
export default function StudentSearch({ onSelect, placeholder = 'Search student by name or registration number…', autoFocus = false }) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);
  const results = useApi(debounced.length >= 2 ? '/students' : null, { search: debounced, pageSize: 8, status: '' });

  return (
    <div className="picker">
      <div className="input-with-icon">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          className="form-control"
          placeholder={placeholder}
          aria-label="Search student"
          autoFocus={autoFocus}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
      </div>
      {debounced.length >= 2 && (
        <ul className="picker__results" role="listbox" aria-label="Matching students">
          {results.loading && <li className="picker__empty">Searching…</li>}
          {results.data?.items.length === 0 && <li className="picker__empty">No matching students.</li>}
          {results.data?.items.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="picker__option"
                onClick={() => {
                  onSelect(student);
                  setTerm('');
                }}
              >
                <span className="data-table__primary">{student.fullName}</span>
                <span className="reg-no">{student.registrationNumber}</span>
                <span className="text-xs text-muted">{classLabel(student.className, student.streamName)} · {student.status}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
