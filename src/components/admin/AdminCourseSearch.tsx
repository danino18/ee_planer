import { useDeferredValue, useMemo, useRef, useState } from 'react';
import type { SapCourse } from '../../types';

interface Props {
  courses: Map<string, SapCourse>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function AdminCourseSearch({ courses, selectedIds, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);

  const q = deferredQuery.trim().toLowerCase();

  const results = useMemo(() => {
    if (q.length < 2) return [];
    const out: SapCourse[] = [];
    for (const course of courses.values()) {
      if (selectedIds.includes(course.id)) continue;
      if (course.id.includes(q) || course.name.toLowerCase().includes(q)) {
        out.push(course);
        if (out.length >= 30) break;
      }
    }
    return out;
  }, [courses, q, selectedIds]);

  function add(id: string) {
    onChange([...selectedIds, id]);
    setQuery('');
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="space-y-2" onBlur={handleBlur}>
      {/* Selected courses — card list */}
      {selectedIds.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {selectedIds.map((id, idx) => {
            const course = courses.get(id);
            return (
              <div
                key={id}
                className={`flex items-center gap-3 px-3 py-2 bg-white ${idx < selectedIds.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none shrink-0"
                  title="הסר"
                >
                  ✕
                </button>
                <div className="flex-1 flex items-baseline gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {course?.name ?? id}
                  </span>
                  <span className="text-xs text-gray-400 font-mono shrink-0">{id}</span>
                </div>
                {course?.credits != null && (
                  <span className="text-xs text-gray-400 shrink-0">{course.credits} נ"ז</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="חפש קורס לפי שם או מספר..."
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          dir="rtl"
        />

        {open && results.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
            {results.map((course) => (
              <button
                key={course.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); add(course.id); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 text-right border-b border-gray-50 last:border-0"
              >
                <span className="text-blue-500 text-base leading-none shrink-0">+</span>
                <span className="flex-1 text-gray-800 truncate">{course.name}</span>
                <span className="text-gray-400 font-mono text-xs shrink-0">{course.id}</span>
                {course.credits != null && (
                  <span className="text-gray-400 text-xs shrink-0">{course.credits} נ"ז</span>
                )}
              </button>
            ))}
          </div>
        )}

        {open && q.length >= 2 && results.length === 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 px-3 py-4 text-center text-xs text-gray-400">
            לא נמצאו קורסים
          </div>
        )}
      </div>
    </div>
  );
}
