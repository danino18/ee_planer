import { memo, useMemo } from 'react';
import type { SapCourse } from '../types';
import type { NoAdditionalCreditConflict } from '../domain/noAdditionalCredit';
import { CourseCard } from './CourseCard';
import { bareId } from '../utils/occurrenceId';

interface BucketViewProps {
  courses: Map<string, SapCourse>;
  semesters: Record<number, string[]>;
  mandatoryIds: Set<string>;
  completedSet: Set<string>;
  prereqStatus: Map<string, string[][]>;
  noAdditionalCreditConflicts: Map<string, NoAdditionalCreditConflict[]>;
  noAdditionalCreditCourseIds: Set<string>;
  courseChainMap: Map<string, string>;
  coreLockedSet: Set<string>;
}

interface BucketCourse {
  occId: string;
  course: SapCourse;
  isCompleted: boolean;
  isMandatory: boolean;
}

function BucketHeader({
  label,
  icon,
  count,
  credits,
  completedCount,
  accentClass,
  badgeClass,
  progressClass,
}: {
  label: string;
  icon: string;
  count: number;
  credits: number;
  completedCount: number;
  accentClass: string;
  badgeClass: string;
  progressClass: string;
}) {
  const pct = count > 0 ? Math.round((completedCount / count) * 100) : 0;
  return (
    <div className={`sticky top-0 z-10 ${accentClass} border-b px-4 py-3 rounded-t-2xl`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-bold text-base text-gray-800">{label}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span className={`${badgeClass} text-xs font-semibold px-2 py-0.5 rounded-full`}>
            {count} קורסים
          </span>
          <span className="text-xs text-gray-500 px-2 py-0.5 rounded-full bg-white/60 border border-gray-200">
            {credits} נ״ז מוצגות*
          </span>
        </div>
      </div>
      {count > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/50 rounded-full h-1.5 overflow-hidden border border-white/80">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressClass}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">{completedCount}/{count} הושלמו</span>
        </div>
      )}
    </div>
  );
}

function EmptyBucket({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
      <span className="text-4xl opacity-40">📭</span>
      <p className="text-sm">אין קורסי {label} משובצים</p>
    </div>
  );
}

export const BucketView = memo(function BucketView({
  courses,
  semesters,
  mandatoryIds,
  completedSet,
  prereqStatus,
  noAdditionalCreditConflicts,
  courseChainMap,
  coreLockedSet,
}: BucketViewProps) {
  const { mandatory, elective } = useMemo(() => {
    const seen = new Set<string>();
    const mandatory: BucketCourse[] = [];
    const elective: BucketCourse[] = [];

    for (const ids of Object.values(semesters)) {
      for (const occId of ids) {
        const cid = bareId(occId);
        if (seen.has(occId)) continue;
        seen.add(occId);
        const course = courses.get(cid);
        if (!course) continue;
        const item: BucketCourse = {
          occId,
          course,
          isCompleted: completedSet.has(occId) || completedSet.has(cid),
          isMandatory: mandatoryIds.has(cid),
        };
        if (item.isMandatory) mandatory.push(item);
        else elective.push(item);
      }
    }

    // Pending (not completed) first, completed last — within each bucket
    const sort = (arr: BucketCourse[]) =>
      [...arr.filter((c) => !c.isCompleted), ...arr.filter((c) => c.isCompleted)];

    return { mandatory: sort(mandatory), elective: sort(elective) };
  }, [semesters, courses, completedSet, mandatoryIds]);

  const mandatoryCredits = mandatory.reduce((s, { course }) => s + (course.credits ?? 0), 0);
  const electiveCredits = elective.reduce((s, { course }) => s + (course.credits ?? 0), 0);
  const mandatoryCompleted = mandatory.filter((c) => c.isCompleted).length;
  const electiveCompleted = elective.filter((c) => c.isCompleted).length;

  const firstCompleted = mandatory.findIndex((c) => c.isCompleted);
  const firstElectiveCompleted = elective.findIndex((c) => c.isCompleted);

  const renderCard = ({ occId, course, isCompleted, isMandatory }: BucketCourse) => (
    <div key={occId} className={isCompleted ? 'opacity-60' : ''}>
      <CourseCard
        course={course}
        courses={courses}
        isMandatory={isMandatory}
        isCompleted={isCompleted}
        missingPrereqGroups={prereqStatus.get(occId) ?? prereqStatus.get(course.id) ?? []}
        noAdditionalCreditConflicts={noAdditionalCreditConflicts.get(occId) ?? noAdditionalCreditConflicts.get(course.id) ?? []}
        chainName={courseChainMap.get(course.id)}
        isCoreLocked={coreLockedSet.has(course.id)}
        draggable={false}
        showActions={false}
      />
    </div>
  );

  return (
    <div dir="rtl" className="flex flex-col sm:flex-row gap-4 mb-4">
      {/* חובה — right panel (RTL: rendered first = right side) */}
      <div className="flex-1 min-w-0 bg-blue-50/60 border border-blue-100 rounded-2xl overflow-hidden flex flex-col">
        <BucketHeader
          label="חובה"
          icon="📘"
          count={mandatory.length}
          credits={mandatoryCredits}
          completedCount={mandatoryCompleted}
          accentClass="bg-blue-100/80 border-blue-200"
          badgeClass="bg-blue-600 text-white"
          progressClass="bg-blue-500"
        />
        <div className="p-3 flex flex-col gap-2 overflow-y-auto">
          {mandatory.length === 0 && <EmptyBucket label="חובה" />}
          {mandatory.map((item, idx) => (
            <div key={item.occId}>
              {firstCompleted !== -1 && idx === firstCompleted && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 border-t border-blue-200" />
                  <span className="text-xs text-blue-400 whitespace-nowrap">הושלמו</span>
                  <div className="flex-1 border-t border-blue-200" />
                </div>
              )}
              {renderCard(item)}
            </div>
          ))}
        </div>
      </div>

      {/* בחירה — left panel */}
      <div className="flex-1 min-w-0 bg-violet-50/60 border border-violet-100 rounded-2xl overflow-hidden flex flex-col">
        <BucketHeader
          label="בחירה"
          icon="🎯"
          count={elective.length}
          credits={electiveCredits}
          completedCount={electiveCompleted}
          accentClass="bg-violet-100/80 border-violet-200"
          badgeClass="bg-violet-600 text-white"
          progressClass="bg-violet-500"
        />
        <div className="p-3 flex flex-col gap-2 overflow-y-auto">
          {elective.length === 0 && <EmptyBucket label="בחירה" />}
          {elective.map((item, idx) => (
            <div key={item.occId}>
              {firstElectiveCompleted !== -1 && idx === firstElectiveCompleted && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 border-t border-violet-200" />
                  <span className="text-xs text-violet-400 whitespace-nowrap">הושלמו</span>
                  <div className="flex-1 border-t border-violet-200" />
                </div>
              )}
              {renderCard(item)}
            </div>
          ))}
        </div>
      </div>

      {/* Footnote */}
      <p className="hidden" aria-hidden="true">* נ״ז מוצגות = סכום נקודות הקורסים בדלי זה. אינו משקף בהכרח נקודות מוכרות לפי מנוע הדרישות.</p>
    </div>
  );
});

BucketView.displayName = 'BucketView';
