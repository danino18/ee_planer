import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import type { SapCourse } from '../types';
import { usePlanStore } from '../store/planStore';
import { CourseCard } from './CourseCard';
import { isCourseTaughtInEnglish, isMelagCourseId, isHumanitiesFreeElectiveCourseId } from '../data/generalRequirements/courseClassification';
import { useShareMode } from '../context/ShareModeContext';

const FILTER_LINKS: Partial<Record<string, { href: string; label: string; tooltip?: string }[]>> = {
  english: [
    {
      href: 'https://ugportal.technion.ac.il/%d7%94%d7%95%d7%a8%d7%90%d7%94-%d7%95%d7%91%d7%97%d7%99%d7%a0%d7%95%d7%aa/%d7%aa%d7%a7%d7%a0%d7%94-1-3-3-%d7%97%d7%95%d7%91%d7%aa-%d7%9c%d7%99%d7%9e%d7%95%d7%93-%d7%a7%d7%95%d7%a8%d7%a1%d7%99%d7%9d-%d7%91%d7%a9%d7%a4%d7%94-%d7%94%d7%90%d7%a0%d7%92%d7%9c%d7%99%d7%aa-compuls/',
      label: 'קורסי אנגלית',
    },
  ],
  melag: [
    {
      href: 'https://ugportal.technion.ac.il/%D7%94%D7%95%D7%A8%D7%90%D7%94-%D7%95%D7%91%D7%97%D7%99%D7%A0%D7%95%D7%AA/%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99-%D7%94%D7%A2%D7%A9%D7%A8%D7%94/',
      label: 'מל"גים',
    },
  ],
  freeElective: [
    {
      href: 'https://humanities.technion.ac.il/courses/%d7%a7%d7%95%d7%a8%d7%a1-%d7%94%d7%a2%d7%a9%d7%a8%d7%94/',
      label: 'קורסי העשרה',
    },
  ],
  winter: [
    {
      href: 'https://ece.technion.ac.il/degree-studies-programs/undergraduate-studies/study-programs-courses/?lang=he',
      label: 'קורסי אביב וחורף',
      tooltip: 'לרדת למטה בדף עד לטבלת הקורסים לפי סמסטר',
    },
  ],
  spring: [
    {
      href: 'https://ece.technion.ac.il/degree-studies-programs/undergraduate-studies/study-programs-courses/?lang=he',
      label: 'קורסי אביב וחורף',
      tooltip: 'לרדת למטה בדף עד לטבלת הקורסים לפי סמסטר',
    },
  ],
};

const SEM_LABELS = [
  "א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'",
  "ח'", "ט'", "י'", 'י"א', 'י"ב', 'י"ג', 'י"ד', 'ט"ו', 'ט"ז',
];

interface Props {
  courses: Map<string, SapCourse>;
  onCourseAdded?: (courseName: string, semesterLabel: string) => void;
}

const PICKER_OPTION_HEIGHT = 34;
const PICKER_VERTICAL_PADDING = 8;
const PICKER_GAP = 6;
const PICKER_VIEWPORT_MARGIN = 16;
const MIN_VISIBLE_PICKER_OPTIONS = 9;
const PICKER_MIN_WIDTH = 208;

type PickerPosition = {
  top: number;
  right: number;
  maxHeight: number;
};

export const CourseSearch = memo(function CourseSearch({ courses, onCourseAdded }: Props) {
  const shareMode = useShareMode();
  const isReadOnly = shareMode?.isShareReview ?? false;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'search' | 'favorites'>('search');
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pickerPosition, setPickerPosition] = useState<PickerPosition | null>(null);
  const [filters, setFilters] = useState({
    english: false,
    melag: false,
    freeElective: false,
    winter: false,
    spring: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerMenuRef = useRef<HTMLDivElement>(null);
  const {
    favorites,
    addCourseToSemester,
    semesterOrder,
    summerSemesters,
    englishTaughtCourses,
  } = usePlanStore(useShallow((state) => ({
    favorites: state.favorites,
    addCourseToSemester: state.addCourseToSemester,
    semesterOrder: state.semesterOrder,
    summerSemesters: state.summerSemesters,
    englishTaughtCourses: state.englishTaughtCourses ?? [],
  })));
  const deferredQuery = useDeferredValue(query);
  const indexedCourses = useMemo(
    () => [...courses.values()].map((course) => ({
      course,
      lowerName: course.name.toLowerCase(),
    })),
    [courses],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setPickerFor(null);
        setPickerPosition(null);
      }
    }

    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current
        && !containerRef.current.contains(target)
        && !pickerMenuRef.current?.contains(target)
      ) {
        setOpen(false);
        setPickerFor(null);
        setPickerPosition(null);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const q = deferredQuery.trim().toLowerCase();
  const hasActiveFilters = filters.english || filters.melag || filters.freeElective || filters.winter || filters.spring;

  const matchesFilters = useCallback((course: SapCourse): boolean => {
    if (filters.english && !isCourseTaughtInEnglish(course, englishTaughtCourses)) {
      return false;
    }

    if (filters.melag && !isMelagCourseId(course.id)) {
      return false;
    }

    if (filters.freeElective && !isHumanitiesFreeElectiveCourseId(course.id)) {
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
  }, [englishTaughtCourses, filters]);

  const searchResults = useMemo(() => {
    if (q.length < 2 && !hasActiveFilters) return [];

    const results: SapCourse[] = [];
    for (const { course, lowerName } of indexedCourses) {
      if (!matchesFilters(course)) continue;
      if (q.length >= 2 && !course.id.includes(q) && !lowerName.includes(q)) continue;
      results.push(course);
      if (results.length >= 12) break;
    }

    return results;
  }, [hasActiveFilters, indexedCourses, q, matchesFilters]);

  const favoriteCourses = useMemo(
    () => favorites
      .map((id) => courses.get(id))
      .filter((course): course is SapCourse => !!course)
      .filter(matchesFilters),
    [courses, favorites, matchesFilters],
  );

  const showDropdown = open && (tab === 'favorites' || query.trim().length >= 2 || hasActiveFilters);

  const semesterOptions = useMemo(() => [
    { label: 'ללא שיבוץ', value: 0 },
    ...semesterOrder.map((sem) => ({
      label: summerSemesters.includes(sem)
        ? 'סמסטר קיץ'
        : `סמסטר ${SEM_LABELS[sem - 1] ?? sem}`,
      value: sem,
    })),
  ], [semesterOrder, summerSemesters]);

  const pickerDesiredHeight = useMemo(
    () => (Math.min(semesterOptions.length, MIN_VISIBLE_PICKER_OPTIONS) * PICKER_OPTION_HEIGHT) + PICKER_VERTICAL_PADDING,
    [semesterOptions.length],
  );

  function addToSemester(courseId: string, semValue: number) {
    addCourseToSemester(courseId, semValue);
    setPickerFor(null);
    setPickerPosition(null);
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

  function openSemesterPicker(button: HTMLButtonElement, courseId: string) {
    const rect = button.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - PICKER_GAP - PICKER_VIEWPORT_MARGIN;
    const spaceAbove = rect.top - PICKER_GAP - PICKER_VIEWPORT_MARGIN;
    const showAbove = spaceBelow < pickerDesiredHeight && spaceAbove > spaceBelow;
    const availableHeight = Math.max(showAbove ? spaceAbove : spaceBelow, PICKER_OPTION_HEIGHT + PICKER_VERTICAL_PADDING);
    const pickerHeight = Math.min(pickerDesiredHeight, availableHeight);
    const top = showAbove
      ? Math.max(PICKER_VIEWPORT_MARGIN, rect.top - PICKER_GAP - pickerHeight)
      : Math.min(rect.bottom + PICKER_GAP, window.innerHeight - PICKER_VIEWPORT_MARGIN - pickerHeight);

    setPickerPosition({
      top,
      right: Math.max(PICKER_VIEWPORT_MARGIN, window.innerWidth - rect.right),
      maxHeight: availableHeight,
    });
    setPickerFor(courseId);
  }

  useEffect(() => {
    if (!pickerFor) return undefined;

    function closePicker() {
      setPickerFor(null);
      setPickerPosition(null);
    }

    window.addEventListener('resize', closePicker);
    window.addEventListener('scroll', closePicker, true);
    return () => {
      window.removeEventListener('resize', closePicker);
      window.removeEventListener('scroll', closePicker, true);
    };
  }, [pickerFor]);

  function renderAddButton(courseId: string) {
    if (isReadOnly) return null;
    const isPickerOpen = pickerFor === courseId;
    return (
      <div className="relative shrink-0">
        <button
          onClick={(event) => {
            event.stopPropagation();
            const button = event.currentTarget;
            if (isPickerOpen) {
              setPickerFor(null);
              setPickerPosition(null);
              return;
            }

            openSemesterPicker(button, courseId);
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
    setPickerPosition(null);
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
            setPickerPosition(null);
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
            setPickerPosition(null);
          }}
          className={`text-sm px-2 py-0.5 rounded-lg transition-colors ${
            tab === 'favorites' && open ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400 hover:text-yellow-500'
          }`}
          title="מועדפים"
        >
          ⭐ {favorites.length > 0 && <span className="text-xs">{favorites.length}</span>}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2 px-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleFilter('english')}
            className={`text-xs border px-2 py-1 rounded-full transition-colors ${
              filters.english ? 'bg-sky-100 text-sky-700 border-sky-300' : 'bg-white text-gray-500 border-gray-200 hover:border-sky-300'
            }`}
          >
            אנגלית
          </button>
          <a href={FILTER_LINKS.english![0].href} target="_blank" rel="noopener noreferrer" title={FILTER_LINKS.english![0].label} className="text-[10px] text-blue-400 hover:text-blue-600 shrink-0">↗</a>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleFilter('melag')}
            className={`text-xs border px-2 py-1 rounded-full transition-colors ${
              filters.melag ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'
            }`}
          >
            מל"ג
          </button>
          <a href={FILTER_LINKS.melag![0].href} target="_blank" rel="noopener noreferrer" title={FILTER_LINKS.melag![0].label} className="text-[10px] text-blue-400 hover:text-blue-600 hover:underline shrink-0">↗</a>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleFilter('freeElective')}
            className={`text-xs border px-2 py-1 rounded-full transition-colors ${
              filters.freeElective ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'
            }`}
          >
            בחירה חופשית
          </button>
          <a href={FILTER_LINKS.freeElective![0].href} target="_blank" rel="noopener noreferrer" title={FILTER_LINKS.freeElective![0].label} className="text-[10px] text-blue-400 hover:text-blue-600 hover:underline shrink-0">↗</a>
        </div>
        <div className="flex items-center gap-1">
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
          <a href={FILTER_LINKS.winter![0].href} target="_blank" rel="noopener noreferrer" title={FILTER_LINKS.winter![0].tooltip} className="text-[10px] text-blue-400 hover:text-blue-600 hover:underline shrink-0">{FILTER_LINKS.winter![0].label} ↗</a>
        </div>
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
      {pickerFor && pickerPosition && createPortal(
        <div
          ref={pickerMenuRef}
          className="fixed z-[120] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-2xl py-1"
          style={{
            top: `${pickerPosition.top}px`,
            right: `${pickerPosition.right}px`,
            minWidth: `${PICKER_MIN_WIDTH}px`,
            maxHeight: `${pickerPosition.maxHeight}px`,
          }}
        >
          {semesterOptions.map(({ label, value }) => (
            <button
              key={value}
              onClick={(event) => {
                event.stopPropagation();
                addToSemester(pickerFor, value);
              }}
              className="w-full text-right text-xs px-3 py-2 hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition-colors whitespace-nowrap"
            >
              {label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
});

CourseSearch.displayName = 'CourseSearch';
