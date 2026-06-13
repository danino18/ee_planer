import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import type { SapCourse } from '../types';
import type { CourseFilters } from '../domain/gradeStatistics/types';
import { usePlanStore } from '../store/planStore';
import { CourseCard } from './CourseCard';
import { CourseFilterPanel } from './CourseFilterPanel';
import { isCourseTaughtInEnglish, isMelagCourseId, isHumanitiesFreeElectiveCourseId, isAdvancedDegreeCourseId } from '../data/generalRequirements/courseClassification';
import { useShareMode } from '../context/ShareModeContext';
import { averageGeneralRank, fetchCheeseForkFeedback, type CheeseForkFeedback } from '../services/cheesefork';
import { useGradeStatistics } from '../services/gradeStatistics';
import { resolveStatistic } from '../domain/gradeStatistics/select';
import {
  computeVisibleCourses,
  defaultFilters,
  matchesAverageMin,
  matchesMedianMin,
  matchesMinStudents,
  matchesSubjects,
} from '../domain/gradeStatistics/filters';
import type { ResolvedStatistic } from '../domain/gradeStatistics/types';

const RATING_FETCH_BATCH_SIZE = 25;
const RATING_FETCH_CANDIDATE_CAP = 50;

// Fetch ratings in this order: EE faculty, then מל"ג, then physics, then math, then everything else.
function ratingFetchPriority(course: SapCourse): number {
  if (course.id.startsWith('004')) return 0;
  if (isMelagCourseId(course.id)) return 1;
  if (course.id.startsWith('011')) return 2;
  if (course.id.startsWith('010')) return 3;
  return 4;
}

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
  const [filters, setFilters] = useState<CourseFilters>(defaultFilters);
  const [ratingsCache, setRatingsCache] = useState<Map<string, CheeseForkFeedback | null>>(new Map());
  const attemptedRatingsRef = useRef<Set<string>>(new Set());
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

  const { data: statsData, status: statsStatus } = useGradeStatistics();

  const updateFilters = useCallback((partial: Partial<CourseFilters>) => {
    setFilters((current) => ({ ...current, ...partial }));
    setOpen(true);
    setTab('search');
    setPickerFor(null);
    setPickerPosition(null);
  }, []);
  const resetFilters = useCallback(() => setFilters(defaultFilters()), []);

  const deferredQuery = useDeferredValue(query);
  const indexedCourses = useMemo(
    () => [...courses.values()].map((course) => ({
      course,
      lowerName: course.name.toLowerCase(),
    })),
    [courses],
  );

  // Resolve the statistic for every course once per (dataset, semester-selection) change.
  const resolvedStats = useMemo(() => {
    const map = new Map<string, ResolvedStatistic | null>();
    if (!statsData) return map;
    for (const { course } of indexedCourses) {
      map.set(course.id, resolveStatistic(statsData.index.get(course.id), filters.statisticsSemester));
    }
    return map;
  }, [statsData, indexedCourses, filters.statisticsSemester]);
  const getStat = useCallback((course: SapCourse) => resolvedStats.get(course.id) ?? null, [resolvedStats]);

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
  const gradeFilterActive =
    filters.averageMin !== null || filters.medianMin !== null || filters.minStudents !== null;
  const hasActiveFilters =
    filters.subjects.length > 0 || filters.english || filters.melag || filters.freeElective ||
    filters.winter || filters.spring || filters.advancedDegree || filters.minRating > 0 ||
    gradeFilterActive;

  // Academic-property predicate (no subjects, grades, rating or query).
  const matchesAcademic = useCallback((course: SapCourse): boolean => {
    if (filters.english && !isCourseTaughtInEnglish(course, englishTaughtCourses)) return false;
    if (filters.melag && !isMelagCourseId(course.id)) return false;
    if (filters.freeElective && !isHumanitiesFreeElectiveCourseId(course.id)) return false;
    if (filters.advancedDegree && !isAdvancedDegreeCourseId(course.id)) return false;
    if (filters.winter || filters.spring) {
      if (!course.teachingSemester) return false;
      return (
        (filters.winter && course.teachingSemester === 'winter') ||
        (filters.spring && course.teachingSemester === 'spring')
      );
    }
    return true;
  }, [englishTaughtCourses, filters.english, filters.melag, filters.freeElective, filters.advancedDegree, filters.winter, filters.spring]);

  const matchesRating = useCallback((course: SapCourse): boolean => {
    if (filters.minRating <= 0) return true;
    const feedback = ratingsCache.get(course.id);
    if (feedback === undefined) return false;
    const avg = averageGeneralRank(feedback);
    return avg !== null && avg >= filters.minRating;
  }, [filters.minRating, ratingsCache]);

  const matchesQueryText = useCallback((course: SapCourse, lowerName: string): boolean => {
    if (q.length < 2) return true;
    return course.id.includes(q) || lowerName.includes(q);
  }, [q]);

  // Everything except the rating filter (used to pick which ratings to fetch).
  const passesPreRating = useCallback((course: SapCourse, lowerName: string): boolean => {
    if (!matchesSubjects(course.id, filters.subjects)) return false;
    if (!matchesAcademic(course)) return false;
    const stat = getStat(course);
    if (!matchesAverageMin(stat, filters.averageMin)) return false;
    if (!matchesMedianMin(stat, filters.medianMin)) return false;
    if (!matchesMinStudents(stat, filters.minStudents)) return false;
    return matchesQueryText(course, lowerName);
  }, [filters.subjects, filters.averageMin, filters.medianMin, filters.minStudents, matchesAcademic, getStat, matchesQueryText]);

  const lowerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const { course, lowerName } of indexedCourses) m.set(course.id, lowerName);
    return m;
  }, [indexedCourses]);

  const searchResults = useMemo(() => {
    if (q.length < 2 && !hasActiveFilters) return [];
    return computeVisibleCourses(
      indexedCourses.map((x) => x.course),
      getStat,
      filters,
      {
        matchesAcademic: (course) => matchesAcademic(course) && matchesRating(course),
        matchesQuery: (course) => matchesQueryText(course, lowerNameById.get(course.id) ?? ''),
        limit: 50,
      },
    );
  }, [q, hasActiveFilters, indexedCourses, getStat, filters, matchesAcademic, matchesRating, matchesQueryText, lowerNameById]);

  const favoriteCourses = useMemo(
    () => computeVisibleCourses(
      favorites.map((id) => courses.get(id)).filter((c): c is SapCourse => !!c),
      getStat,
      filters,
      {
        matchesAcademic: (course) => matchesAcademic(course) && matchesRating(course),
        matchesQuery: (course) => matchesQueryText(course, (course.name ?? '').toLowerCase()),
      },
    ),
    [courses, favorites, getStat, filters, matchesAcademic, matchesRating, matchesQueryText],
  );

  const ratingFetchCandidates = useMemo(() => {
    if (filters.minRating <= 0) return [];

    const out: SapCourse[] = [];
    for (const { course, lowerName } of indexedCourses) {
      if (passesPreRating(course, lowerName)) out.push(course);
    }
    out.sort((a, b) => ratingFetchPriority(a) - ratingFetchPriority(b));
    const capped = out.slice(0, RATING_FETCH_CANDIDATE_CAP);

    for (const id of favorites) {
      const course = courses.get(id);
      if (course && passesPreRating(course, (course.name ?? '').toLowerCase()) && !capped.some((c) => c.id === course.id)) {
        capped.push(course);
      }
    }
    return capped;
  }, [filters.minRating, indexedCourses, passesPreRating, favorites, courses]);

  // Reset the attempted-fetch tracker whenever the rating filter is freshly activated.
  const ratingFilterActive = filters.minRating > 0;
  useEffect(() => {
    if (ratingFilterActive) attemptedRatingsRef.current.clear();
  }, [ratingFilterActive]);

  useEffect(() => {
    if (filters.minRating <= 0) return;

    const toFetch = ratingFetchCandidates
      .filter((course) => !ratingsCache.has(course.id) && !attemptedRatingsRef.current.has(course.id))
      .slice(0, RATING_FETCH_BATCH_SIZE);

    if (toFetch.length === 0) return;

    let cancelled = false;
    for (const course of toFetch) attemptedRatingsRef.current.add(course.id);

    Promise.all(toFetch.map(async (course) => {
      const feedback = await fetchCheeseForkFeedback(course.id);
      return [course.id, feedback] as const;
    })).then((entries) => {
      if (cancelled) return;
      setRatingsCache((prev) => {
        const next = new Map(prev);
        for (const [id, feedback] of entries) next.set(id, feedback);
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [filters.minRating, ratingFetchCandidates, ratingsCache]);

  const ratingLoading = filters.minRating > 0 && ratingFetchCandidates.some((course) => !ratingsCache.has(course.id));

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

      <CourseFilterPanel
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
        availableSemesters={statsData?.semesters ?? []}
        statsAvailable={statsStatus === 'ready' && !!statsData}
        statsLoading={statsStatus === 'loading'}
        ratingLoading={ratingLoading}
      />

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
                        <CourseCard course={course} isMandatory={false} gradeStat={getStat(course)} />
                      </div>
                      {renderAddButton(course.id)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3">
              {filters.minRating > 0 && ratingLoading && (
                <p className="text-xs text-gray-400 text-center pb-1.5">טוען דירוגים…</p>
              )}
              {searchResults.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">לא נמצאו קורסים</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {searchResults.map((course) => (
                    <div key={course.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <CourseCard course={course} isMandatory={false} gradeStat={getStat(course)} />
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
