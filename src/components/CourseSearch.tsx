import { useState, useRef, useEffect } from 'react';
import type { SapCourse } from '../types';
import { usePlanStore } from '../store/planStore';
import { CourseCard } from './CourseCard';
import { isCourseTaughtInEnglish, isMelagCourseId } from '../data/generalRequirements/courseClassification';

const SEM_LABELS = [
  "א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'",
  "ח'", "ט'", "י'", 'י"א', 'י"ב', 'י"ג', 'י"ד', 'ט"ו', 'ט"ז',
];

interface Props {
  courses: Map<string, SapCourse>;
  onCourseAdded?: (courseName: string, semesterLabel: string) => void;
}

export function CourseSearch({ courses, onCourseAdded }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'search' | 'favorites'>('search');
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    english: false,
    melag: false,
    winter: false,
    spring: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    favorites,
    addCourseToSemester,
    semesterOrder,
    summerSemesters,
    englishTaughtCourses,
  } = usePlanStore();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setPickerFor(null);
      }
    }

    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
  const hasActiveFilters = filters.english || filters.melag || filters.winter || filters.spring;

  function matchesFilters(course: SapCourse): boolean {
    if (filters.english && !isCourseTaughtInEnglish(course, englishTaughtCourses ?? [])) {
      return false;
    }

    if (filters.melag && !isMelagCourseId(course.id)) {
      return false;
    }

    if (filters.winter || filters.spring) {
      if (!course.teachingSemester) return false;
      return (
        (filters.winter && course.teachingSemester === 'winter') ||
        (filters.spring && course.teachingSemester === 'spring')
      );
    }

    return true;
  }

  const searchResults: SapCourse[] = q.length >= 2
    ? [...courses.values()]
      .filter((course) => (course.id.includes(q) || course.name.toLowerCase().includes(q)) && matchesFilters(course))
      .slice(0, 12)
    : hasActiveFilters
      ? [...courses.values()].filter(matchesFilters).slice(0, 12)
      : [];

  const favoriteCourses: SapCourse[] = favorites
    .map((id) => courses.get(id))
    .filter((course): course is SapCourse => !!course)
    .filter(matchesFilters);

  const showDropdown = open && (tab === 'favorites' || q.length >= 2 || hasActiveFilters);

  const semesterOptions = [
    { label: 'ללא שיבוץ', value: 0 },
    ...semesterOrder.map((sem) => ({
      label: summerSemesters.includes(sem)
        ? 'סמסטר קיץ'
        : `סמסטר ${SEM_LABELS[sem - 1] ?? sem}`,
      value: sem,
    })),
  ];

  function addToSemester(courseId: string, semValue: number) {
    addCourseToSemester(courseId, semValue);
    setPickerFor(null);
    if (onCourseAdded) {
      const course = courses.get(courseId);
      const semLabel = semValue === 0
        ? 'ללא שיבוץ'
        : summerSemesters.includes(semValue)
          ? 'סמסטר קיץ'
          : `סמסטר ${SEM_LABELS[semValue - 1] ?? semValue}`;
      onCourseAdded(course?.name ?? courseId, semLabel);
    }
  }

  function renderAddButton(courseId: string) {
    const isPickerOpen = pickerFor === courseId;
    return (
      <div className="relative shrink-0">
        <button
          onClick={(event) => {
            event.stopPropagation();
            setPickerFor(isPickerOpen ? null : courseId);
          }}
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
                onClick={(event) => {
                  event.stopPropagation();
                  addToSemester(courseId, value);
                }}
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

  function toggleFilter(filterKey: keyof typeof filters) {
    setFilters((current) => ({
      ...current,
      [filterKey]: !current[filterKey],
    }));
    setOpen(true);
    setTab('search');
    setPickerFor(null);
  }

  return (
    <div ref={containerRef} className="relative mb-3">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <span className="text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setTab('search');
            setPickerFor(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder="חפש קורס לפי שם או מספר..."
          className="flex-1 text-sm outline-none bg-transparent text-right"
          dir="rtl"
        />
        <button
          onClick={() => {
            setTab('favorites');
            setOpen(true);
            setPickerFor(null);
          }}
          className={`text-sm px-2 py-0.5 rounded-lg transition-colors ${
            tab === 'favorites' && open ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400 hover:text-yellow-500'
          }`}
          title="מועדפים"
        >
          ⭐ {favorites.length > 0 && <span className="text-xs">{favorites.length}</span>}
        </button>
      </div>

      <div className="flex items-center gap-2 mt-2 px-1">
        <button
          onClick={() => toggleFilter('english')}
          className={`text-xs border px-2 py-1 rounded-full transition-colors ${
            filters.english ? 'bg-sky-100 text-sky-700 border-sky-300' : 'bg-white text-gray-500 border-gray-200 hover:border-sky-300'
          }`}
        >
          אנגלית
        </button>
        <button
          onClick={() => toggleFilter('melag')}
          className={`text-xs border px-2 py-1 rounded-full transition-colors ${
            filters.melag ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'
          }`}
        >
          מל"ג
        </button>
        <button
          onClick={() => toggleFilter('winter')}
          className={`text-xs border px-2 py-1 rounded-full transition-colors ${
            filters.winter ? 'bg-cyan-100 text-cyan-700 border-cyan-300' : 'bg-white text-gray-500 border-gray-200 hover:border-cyan-300'
          }`}
        >
          חורף
        </button>
        <button
          onClick={() => toggleFilter('spring')}
          className={`text-xs border px-2 py-1 rounded-full transition-colors ${
            filters.spring ? 'bg-pink-100 text-pink-700 border-pink-300' : 'bg-white text-gray-500 border-gray-200 hover:border-pink-300'
          }`}
        >
          אביב
        </button>
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          {tab === 'favorites' ? (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">⭐ מועדפים</p>
              {favoriteCourses.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">אין קורסים מועדפים שתואמים לחיפוש או לפילטרים</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {favoriteCourses.map((course) => (
                    <div key={course.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <CourseCard course={course} isMandatory={false} />
                      </div>
                      {renderAddButton(course.id)}
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
                  {searchResults.map((course) => (
                    <div key={course.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <CourseCard course={course} isMandatory={false} />
                      </div>
                      {renderAddButton(course.id)}
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
