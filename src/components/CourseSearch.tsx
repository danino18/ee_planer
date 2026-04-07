import { useState, useRef, useEffect } from 'react';
import type { SapCourse } from '../types';
import { usePlanStore } from '../store/planStore';
import { CourseCard } from './CourseCard';

const SEM_LABELS = [
  'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳',
  'ח׳', 'ט׳', 'י׳', 'יא׳', 'יב׳', 'יג׳', 'יד׳', 'טו׳', 'טז׳',
];

interface Props {
  courses: Map<string, SapCourse>;
}

export function CourseSearch({ courses }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'search' | 'favorites'>('search');
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { favorites, addCourseToSemester, semesterOrder, summerSemesters } = usePlanStore();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setPickerFor(null); }
    }
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPickerFor(null);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const searchResults: SapCourse[] = q.length >= 2
    ? [...courses.values()]
        .filter((c) => c.id.includes(q) || c.name.toLowerCase().includes(q))
        .slice(0, 12)
    : [];

  const favoriteCourses: SapCourse[] = favorites
    .map((id) => courses.get(id))
    .filter((c): c is SapCourse => !!c);

  const showDropdown = open && (tab === 'favorites' || q.length >= 2);

  // Build semester options for the picker
  const semesterOptions = [
    { label: 'ללא שיבוץ', value: 0 },
    ...semesterOrder.map((sem) => ({
      label: summerSemesters.includes(sem)
        ? `קיץ`
        : `סמסטר ${SEM_LABELS[sem - 1] ?? sem}`,
      value: sem,
    })),
  ];

  function addToSemester(courseId: string, semValue: number) {
    addCourseToSemester(courseId, semValue);
    setPickerFor(null);
  }

  function renderAddButton(courseId: string) {
    const isPickerOpen = pickerFor === courseId;
    return (
      <div className="relative shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setPickerFor(isPickerOpen ? null : courseId); }}
          className={`text-xs border px-2 py-1 rounded-lg transition-colors ${
            isPickerOpen
              ? 'bg-blue-500 text-white border-blue-500'
              : 'text-blue-600 hover:text-blue-800 border-blue-200 hover:border-blue-400'
          }`}
          title="בחר סמסטר להוספה"
        >
          +
        </button>
        {isPickerOpen && (
          <div className="absolute left-0 top-full mt-1 z-[60] bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[140px]">
            {semesterOptions.map(({ label, value }) => (
              <button
                key={value}
                onClick={(e) => { e.stopPropagation(); addToSemester(courseId, value); }}
                className="w-full text-right text-xs px-3 py-1.5 hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative mb-3">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <span className="text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setTab('search'); setPickerFor(null); }}
          onFocus={() => setOpen(true)}
          placeholder="חפש קורס לפי שם או מספר..."
          className="flex-1 text-sm outline-none bg-transparent text-right"
          dir="rtl"
        />
        <button
          onClick={() => { setTab('favorites'); setOpen(true); setPickerFor(null); }}
          className={`text-sm px-2 py-0.5 rounded-lg transition-colors ${tab === 'favorites' && open ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400 hover:text-yellow-500'}`}
          title="מועדפים"
        >
          ⭐ {favorites.length > 0 && <span className="text-xs">{favorites.length}</span>}
        </button>
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          {tab === 'favorites' ? (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">⭐ מועדפים</p>
              {favoriteCourses.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">אין קורסים מועדפים עדיין</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {favoriteCourses.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <CourseCard course={c} isMandatory={false} />
                      </div>
                      {renderAddButton(c.id)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3">
              {searchResults.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">לא נמצאו קורסים</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {searchResults.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <CourseCard course={c} isMandatory={false} />
                      </div>
                      {renderAddButton(c.id)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
