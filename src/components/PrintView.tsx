import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore';
import type { SapCourse, TrackDefinition, TrackSpecializationCatalog } from '../types';
import { getFacultyStyle } from '../utils/faculty';
import { computeWeightedAverage, gradeKey } from '../utils/courseGrades';

interface Props {
  courses: Map<string, SapCourse>;
  trackDef: TrackDefinition | null;
  catalog: TrackSpecializationCatalog | null;
}

function seasonLabel(
  semester: number,
  summerSemesters: number[],
  overrides: Record<number, 'winter' | 'spring'> | undefined,
): string {
  if (semester === 0) return '';
  if (summerSemesters.includes(semester)) return 'קיץ';
  const override = overrides?.[semester];
  if (override === 'winter') return 'חורף';
  if (override === 'spring') return 'אביב';
  return semester % 2 === 1 ? 'חורף' : 'אביב';
}

function formatSemesterLabel(semester: number): string {
  if (semester === 0) return 'הושלם מראש';
  return `סמסטר ${semester}`;
}

interface CourseRowProps {
  course: SapCourse;
  grade: number | undefined;
  isBinary: boolean;
  isCompleted: boolean;
  facultyOverrides: Record<string, string> | undefined;
}

function PrintCourseRow({ course, grade, isBinary, isCompleted, facultyOverrides }: CourseRowProps) {
  const style = getFacultyStyle(course.faculty, course.id, facultyOverrides);
  return (
    <div className="print-course">
      <span className={`print-dot ${style.dot}`} />
      <div className="print-course-body">
        <div className="print-course-name">{course.name}</div>
        <div className="print-course-meta">
          <span className="print-course-id">{course.id}</span>
          <span className="print-course-credits">{course.credits} נ״ז</span>
          {isCompleted && <span className="print-completed">✓</span>}
          {isBinary && <span className="print-binary">עובר</span>}
          {grade !== undefined && !isBinary && (
            <span className="print-grade">{grade}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrintView({ courses, trackDef, catalog }: Props) {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const grades = usePlanStore((s) => s.grades);
  const binaryPass = usePlanStore((s) => s.binaryPass);
  const semesterOrder = usePlanStore((s) => s.semesterOrder);
  const summerSemesters = usePlanStore((s) => s.summerSemesters);
  const semesterTypeOverrides = usePlanStore((s) => s.semesterTypeOverrides);
  const currentSemester = usePlanStore((s) => s.currentSemester);
  const facultyColorOverrides = usePlanStore((s) => s.facultyColorOverrides);
  const selectedSpecializations = usePlanStore((s) => s.selectedSpecializations);
  const doubleSpecializations = usePlanStore((s) => s.doubleSpecializations);

  const { totalCredits, weightedAvg, completedSet } = useMemo(() => {
    const completedSet = new Set(completedCourses);
    const placed = new Set<string>([...completedCourses, ...Object.values(semesters).flat()]);
    const totalCredits = [...placed].reduce(
      (sum, id) => sum + (courses.get(id)?.credits ?? 0),
      0,
    );
    const weightedAvg = computeWeightedAverage(
      { semesters, grades, binaryPass: binaryPass ?? {} },
      courses,
    );
    return { totalCredits, weightedAvg, completedSet };
  }, [semesters, completedCourses, grades, binaryPass, courses]);

  const semesterList = semesterOrder.length > 0
    ? semesterOrder.filter((s) => s !== 0)
    : Object.keys(semesters)
        .map(Number)
        .filter((n) => n > 0)
        .sort((a, b) => a - b);

  const preCourses = semesters[0] ?? [];

  const dateStr = new Date().toLocaleDateString('he-IL');

  return (
    <div className="print-view" dir="rtl" aria-hidden="true">
      <header className="print-header">
        <div>
          <h1 className="print-title">מתכנן לימודים – הטכניון</h1>
          {trackDef && <p className="print-subtitle">{trackDef.name}</p>}
        </div>
        <div className="print-meta">
          <div><span className="print-meta-label">תאריך:</span> {dateStr}</div>
          <div><span className="print-meta-label">סה״כ נ״ז:</span> {totalCredits}</div>
          {weightedAvg !== null && (
            <div><span className="print-meta-label">ממוצע משוקלל:</span> {weightedAvg.toFixed(2)}</div>
          )}
          {trackDef && (
            <div><span className="print-meta-label">נדרש:</span> {trackDef.totalCreditsRequired} נ״ז</div>
          )}
        </div>
      </header>

      {preCourses.length > 0 && (
        <section className="print-pre-section">
          <h2 className="print-section-title">הושלם מראש</h2>
          <div className="print-course-list print-course-list-wide">
            {preCourses.map((id) => {
              const course = courses.get(id);
              if (!course) return null;
              const grade = grades[gradeKey(id, 0)] ?? grades[id];
              const isBinary = !!(binaryPass ?? {})[id];
              return (
                <PrintCourseRow
                  key={id}
                  course={course}
                  grade={grade}
                  isBinary={isBinary}
                  isCompleted
                  facultyOverrides={facultyColorOverrides}
                />
              );
            })}
          </div>
        </section>
      )}

      <div className="print-semesters-grid">
        {semesterList.map((sem) => {
          const courseIds = semesters[sem] ?? [];
          const season = seasonLabel(sem, summerSemesters ?? [], semesterTypeOverrides);
          const isSummer = (summerSemesters ?? []).includes(sem);
          const isCurrent = currentSemester === sem;
          const semCredits = courseIds.reduce(
            (sum, id) => sum + (courses.get(id)?.credits ?? 0),
            0,
          );
          const semAvg = computeWeightedAverage(
            { semesters, grades, binaryPass: binaryPass ?? {} },
            courses,
            sem,
          );

          return (
            <div
              key={sem}
              className={`print-semester ${isSummer ? 'print-semester-summer' : ''} ${
                isCurrent ? 'print-semester-current' : ''
              }`}
            >
              <div className="print-semester-header">
                <div className="print-semester-title">
                  {isSummer && <span className="print-summer-icon">☀</span>}
                  <span>{formatSemesterLabel(sem)}</span>
                  {season && !isSummer && (
                    <span className="print-season-badge">{season}</span>
                  )}
                </div>
                <div className="print-semester-stats">
                  <span className="print-credits-badge">{semCredits} נ״ז</span>
                  {semAvg !== null && (
                    <span className="print-avg-badge">{semAvg.toFixed(1)}</span>
                  )}
                </div>
              </div>
              <div className="print-course-list">
                {courseIds.length === 0 ? (
                  <div className="print-empty">—</div>
                ) : (
                  courseIds.map((id) => {
                    const course = courses.get(id);
                    if (!course) return null;
                    const grade = grades[gradeKey(id, sem)] ?? grades[id];
                    const isBinary = !!(binaryPass ?? {})[id];
                    return (
                      <PrintCourseRow
                        key={id}
                        course={course}
                        grade={grade}
                        isBinary={isBinary}
                        isCompleted={completedSet.has(id)}
                        facultyOverrides={facultyColorOverrides}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedSpecializations.length > 0 && catalog && (
        <section className="print-specs-section">
          <h2 className="print-section-title">שרשראות נבחרות</h2>
          <ul className="print-specs-list">
            {selectedSpecializations.map((id) => {
              const group = catalog.groups.find((g) => g.id === id);
              const isDouble = (doubleSpecializations ?? []).includes(id);
              return (
                <li key={id} className="print-spec-item">
                  {group?.name ?? id}
                  {isDouble && <span className="print-spec-tag"> · כפולה</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="print-footer">
        <span>נוצר ב-{dateStr} · מתכנן לימודים – הטכניון</span>
      </footer>
    </div>
  );
}
