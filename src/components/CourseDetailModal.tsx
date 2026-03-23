import { useState, useEffect, useMemo } from 'react';
import type { SapCourse } from '../types';
import { usePlanStore } from '../store/planStore';

interface Props {
  course: SapCourse;
  courses: Map<string, SapCourse>;
  onClose: () => void;
}

export function CourseDetailModal({ course, courses, onClose }: Props) {
  const {
    grades, setGrade,
    substitutions, setSubstitution,
    completedCourses, semesters,
    selectedPrereqGroups, setSelectedPrereqGroup,
  } = usePlanStore();

  const currentGrade = grades[course.id];
  const currentSubTarget = substitutions[course.id];
  const [gradeInput, setGradeInput] = useState(currentGrade !== undefined ? String(currentGrade) : '');
  const [subSearch, setSubSearch] = useState('');
  const [customSearch, setCustomSearch] = useState('');

  const allInPlan = useMemo(
    () => new Set([...completedCourses, ...Object.values(semesters).flat()]),
    [completedCourses, semesters]
  );

  // Prereq path selection state
  const prereqs = course.prerequisites; // string[][]
  const savedGroup = selectedPrereqGroups[course.id]; // undefined | string[]
  const savedIdx = savedGroup
    ? prereqs.findIndex(g => g.length === savedGroup.length && g.every((id, i) => id === savedGroup[i]))
    : -1;

  const [mode, setMode] = useState<'auto' | number | 'custom'>(
    savedGroup === undefined ? 'auto'
    : savedIdx >= 0 ? savedIdx
    : 'custom'
  );
  const [customGroup, setCustomGroup] = useState<string[]>(
    savedGroup && savedIdx < 0 ? savedGroup : []
  );

  // Substitution search results
  const subResults = useMemo(() => {
    const q = subSearch.trim();
    if (q.length < 2) return [];
    const lower = q.toLowerCase();
    const results: SapCourse[] = [];
    for (const c of courses.values()) {
      if (c.id === course.id) continue;
      if (c.id.includes(q) || c.name.toLowerCase().includes(lower)) {
        results.push(c);
        if (results.length >= 6) break;
      }
    }
    return results;
  }, [subSearch, courses, course.id]);

  // Custom group course search results
  const customResults = useMemo(() => {
    const q = customSearch.trim();
    if (q.length < 2) return [];
    const lower = q.toLowerCase();
    const results: SapCourse[] = [];
    for (const c of courses.values()) {
      if (c.id === course.id || customGroup.includes(c.id)) continue;
      if (c.id.includes(q) || c.name.toLowerCase().includes(lower)) {
        results.push(c);
        if (results.length >= 5) break;
      }
    }
    return results;
  }, [customSearch, courses, course.id, customGroup]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSaveGrade() {
    const val = parseFloat(gradeInput);
    if (!isNaN(val) && val >= 0 && val <= 100) setGrade(course.id, val);
    onClose();
  }

  const numVal = parseFloat(gradeInput);
  const isValid = gradeInput === '' || (!isNaN(numVal) && numVal >= 0 && numVal <= 100);
  const subTargetCourse = currentSubTarget ? courses.get(currentSubTarget) : null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 leading-snug">{course.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{course.id} · {course.credits} נ״ז</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none mr-2">✕</button>
        </div>

        {/* Prerequisites section */}
        <div className="mb-4 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">תנאי קדם</p>

          {prereqs.length === 0 && (
            <p className="text-xs text-gray-400 italic">אין תנאי קדם</p>
          )}

          {prereqs.length > 0 && (
            <div className="space-y-1">
              {/* אוטומטי */}
              <label className="flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  checked={mode === 'auto'}
                  onChange={() => { setMode('auto'); setSelectedPrereqGroup(course.id, null); }}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-xs text-gray-600 font-medium">
                  אוטומטי <span className="text-gray-400 font-normal">(ברירת מחדל)</span>
                </span>
              </label>

              {/* כל OR-group */}
              {prereqs.map((orGroup, gi) => {
                const satisfied = orGroup.every(id => allInPlan.has(id));
                return (
                  <label
                    key={gi}
                    className={`flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-gray-50 ${
                      mode === gi ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      checked={mode === gi}
                      onChange={() => { setMode(gi); setSelectedPrereqGroup(course.id, orGroup); }}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-xs font-medium text-gray-700">אפשרות {gi + 1}</span>
                        {satisfied && <span className="text-xs text-green-600">✓</span>}
                      </div>
                      <ul className="space-y-0.5">
                        {orGroup.map(id => {
                          const inPlan = allInPlan.has(id);
                          const name = courses.get(id)?.name ?? id;
                          return (
                            <li key={id} className={`text-xs flex items-center gap-1 ${inPlan ? 'text-green-700' : 'text-gray-500'}`}>
                              <span className="font-bold">{inPlan ? '✓' : '✗'}</span>
                              <span>{name}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </label>
                );
              })}

              {/* הרכב בעצמי */}
              <label className={`flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-gray-50 ${
                mode === 'custom' ? 'bg-orange-50 border border-orange-200' : ''
              }`}>
                <input
                  type="radio"
                  checked={mode === 'custom'}
                  onChange={() => setMode('custom')}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-xs font-medium text-gray-600">הרכב קדמים בעצמי...</span>
              </label>

              {/* Custom builder */}
              {mode === 'custom' && (
                <div className="pr-5 space-y-1.5 pt-1">
                  {customGroup.map(id => {
                    const inPlan = allInPlan.has(id);
                    const name = courses.get(id)?.name ?? id;
                    return (
                      <div
                        key={id}
                        className={`flex items-center justify-between text-xs px-2 py-1 rounded border ${
                          inPlan ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        <span>{inPlan ? '✓' : '✗'} {name}</span>
                        <button
                          onClick={() => {
                            const next = customGroup.filter(x => x !== id);
                            setCustomGroup(next);
                            setSelectedPrereqGroup(course.id, next.length > 0 ? next : null);
                          }}
                          className="text-gray-400 hover:text-red-500 mr-1"
                        >✕</button>
                      </div>
                    );
                  })}
                  <input
                    type="text"
                    value={customSearch}
                    onChange={e => setCustomSearch(e.target.value)}
                    placeholder="חפש קורס להוספה..."
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-400 text-right"
                  />
                  {customResults.length > 0 && (
                    <ul className="border border-gray-200 rounded overflow-hidden divide-y divide-gray-100">
                      {customResults.map(c => (
                        <li key={c.id}>
                          <button
                            className="w-full text-right px-2 py-1 text-xs hover:bg-blue-50"
                            onClick={() => {
                              const next = [...customGroup, c.id];
                              setCustomGroup(next);
                              setSelectedPrereqGroup(course.id, next);
                              setCustomSearch('');
                            }}
                          >
                            {c.name} <span className="text-gray-400">({c.id})</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Substitution section */}
        <div className="mb-4 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">מחליף קדם</p>
          <p className="text-xs text-gray-400 mb-2 leading-relaxed">
            אם קורס זה שקול לקורס אחר בטכניון, בחר אותו כדי שיתפוס את מקומו בבדיקת קדמים.
          </p>
          {subTargetCourse ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-medium text-blue-800">{subTargetCourse.name}</p>
                <p className="text-xs text-blue-500">{subTargetCourse.id}</p>
              </div>
              <button
                onClick={() => setSubstitution(course.id, null)}
                className="text-blue-400 hover:text-red-500 text-sm font-bold mr-1 transition-colors"
              >✕</button>
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
                placeholder="חפש קורס לפי שם או מספר..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 text-right"
              />
              {subResults.length > 0 && (
                <ul className="mt-1.5 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                  {subResults.map((c) => (
                    <li key={c.id}>
                      <button
                        className="w-full text-right px-3 py-2 text-xs hover:bg-blue-50 transition-colors"
                        onClick={() => { setSubstitution(course.id, c.id); setSubSearch(''); }}
                      >
                        <span className="font-medium text-gray-800">{c.name}</span>
                        <span className="text-gray-400 mr-1"> ({c.id})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Grade */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">ציון (0–100)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={gradeInput}
            onChange={(e) => setGradeInput(e.target.value)}
            placeholder="הזן ציון..."
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition-colors text-right
              ${isValid ? 'border-gray-300 focus:border-blue-400' : 'border-red-400'}`}
          />
          {!isValid && <p className="text-xs text-red-500 mt-1">ציון חייב להיות בין 0 ל-100</p>}
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSaveGrade}
            disabled={!isValid || gradeInput === ''}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            שמור ציון
          </button>
          {currentGrade !== undefined && (
            <button
              onClick={() => { setGrade(course.id, null); onClose(); }}
              className="text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-2 rounded-lg transition-colors"
            >
              מחק ציון
            </button>
          )}
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-lg transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
