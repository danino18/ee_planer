import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import type { SpecializationCourseReference, SpecializationGroup, SpecializationRuleBlock, SapCourse } from '../types';
import { buildEffectiveChainAssignments, evaluateSpecializationGroup } from '../domain/specializations';
import { getTrackSpecializationCatalog } from '../domain/specializations';
import { usePlanStore } from '../store/planStore';
import { isCourseTaughtInEnglish } from '../data/generalRequirements/courseClassification';
import { getTeachingSemesterBadge } from '../utils/teachingSemester';
import { CourseDetailModal } from './CourseDetailModal';
import { buildCoreLockedSet } from '../domain/degreeCompletion/helpers';
import { getTrackDefinition } from '../data/tracks';

interface Props {
  group: SpecializationGroup;
  courses: Map<string, SapCourse>;
  onClose: () => void;
}

function summarizeBlock(block: SpecializationRuleBlock): string {
  const prefixes: Record<SpecializationRuleBlock['kind'], string> = {
    mandatory_courses: 'חובה',
    mandatory_choice: 'בחירת חובה',
    selection_rule: 'בחירה',
    additional_courses: 'קורס נוסף',
  };
  return `${block.satisfiedCount}/${block.requiredCount} ${prefixes[block.kind]}`;
}

export function SpecializationGroupModal({ group, courses, onClose }: Props) {
  const {
    favorites,
    toggleFavorite,
    semesters,
    completedCourses,
    addCourseToSemester,
    englishTaughtCourses,
    doubleSpecializations,
    selectedSpecializations,
    courseChainAssignments,
    setCourseChainAssignment,
    coreToChainOverrides,
    trackId,
  } = usePlanStore(useShallow((state) => ({
    favorites: state.favorites,
    toggleFavorite: state.toggleFavorite,
    semesters: state.semesters,
    completedCourses: state.completedCourses,
    addCourseToSemester: state.addCourseToSemester,
    englishTaughtCourses: state.englishTaughtCourses ?? [],
    doubleSpecializations: state.doubleSpecializations ?? [],
    selectedSpecializations: state.selectedSpecializations,
    courseChainAssignments: state.courseChainAssignments,
    setCourseChainAssignment: state.setCourseChainAssignment,
    coreToChainOverrides: state.coreToChainOverrides ?? [],
    trackId: state.trackId,
  })));
  const [detailCourse, setDetailCourse] = useState<SapCourse | null>(null);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const allPlaced = useMemo(
    () => new Set([...completedCourses, ...Object.values(semesters).flat()]),
    [completedCourses, semesters],
  );
  const trackDef = useMemo(() => getTrackDefinition(trackId), [trackId]);
  const allGroups = useMemo(
    () => trackId ? getTrackSpecializationCatalog(trackId).groups : [],
    [trackId],
  );
  const coreLockedSet = useMemo(
    () => trackDef ? buildCoreLockedSet({ semesters, completedCourses, coreToChainOverrides, courseChainAssignments }, trackDef) : new Set<string>(),
    [semesters, completedCourses, coreToChainOverrides, courseChainAssignments, trackDef],
  );
  const chainEligibleSet = useMemo(
    () => new Set([...allPlaced].filter((id) => !coreLockedSet.has(id))),
    [allPlaced, coreLockedSet],
  );
  const selectedGroupsForModal = useMemo(
    () => allGroups.filter((g) => selectedSpecializations.includes(g.id) || g.id === group.id),
    [allGroups, selectedSpecializations, group.id],
  );
  const effectiveChainAssignments = useMemo(
    () => buildEffectiveChainAssignments(chainEligibleSet, selectedGroupsForModal, courseChainAssignments),
    [chainEligibleSet, selectedGroupsForModal, courseChainAssignments],
  );
  // Catalog-wide multi-chain set: courses that belong to 2+ catalog chains
  const catalogMultiChainSet = useMemo(() => {
    const count = new Map<string, number>();
    for (const g of allGroups) {
      for (const id of [...g.mandatoryCourses, ...g.electiveCourses]) {
        count.set(id, (count.get(id) ?? 0) + 1);
      }
    }
    return new Set([...count.entries()].filter(([, c]) => c > 1).map(([id]) => id));
  }, [allGroups]);
  const mode = group.canBeDouble && doubleSpecializations.includes(group.id) ? 'double' : 'single';
  const evaluation = useMemo(
    () => evaluateSpecializationGroup(group, chainEligibleSet, mode, effectiveChainAssignments),
    [chainEligibleSet, group, mode, effectiveChainAssignments],
  );
  const displayedCourseNumbers = useMemo(
    () => new Set(evaluation.ruleBlocks.flatMap((block) => block.options.map((option) => option.courseNumber))),
    [evaluation.ruleBlocks],
  );
  const extraCourses = useMemo(
    () => group.courses.filter((course) => !displayedCourseNumbers.has(course.courseNumber)),
    [displayedCourseNumbers, group.courses],
  );

  const renderCourse = (courseRef: SpecializationCourseReference) => {
    const id = courseRef.courseNumber;
    const course = courses.get(id);
    const isInPlan = allPlaced.has(id);
    const isCoreLockedCourse = coreLockedSet.has(id);
    const isChainEligible = chainEligibleSet.has(id);
    const effectiveAssignment = effectiveChainAssignments[id];
    const explicitAssignment = courseChainAssignments?.[id];
    const isAssignedHere = effectiveAssignment === group.id;
    const isAssignedElsewhere = !!effectiveAssignment && effectiveAssignment !== group.id;
    const isManuallyAssignedHere = explicitAssignment === group.id;
    const assignedElsewhereName = isAssignedElsewhere
      ? (allGroups.find((g) => g.id === effectiveAssignment)?.name ?? effectiveAssignment)
      : undefined;
    const isMultiChain = catalogMultiChainSet.has(id);
    const showAssignButton = isInPlan && (
      isCoreLockedCourse ||
      isManuallyAssignedHere ||
      isAssignedElsewhere ||
      (isChainEligible && isMultiChain && !isAssignedHere)
    );
    const isNotCountedHere = isInPlan && !isAssignedHere;
    const isFav = favoriteSet.has(id);
    const showsEnglishBadge = course ? isCourseTaughtInEnglish(course, englishTaughtCourses) : false;
    const seasonBadge = getTeachingSemesterBadge(course?.teachingSemester);
    return (
      <div key={id} className={`flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 ${isNotCountedHere ? 'opacity-50' : ''}`}>
        <div className="flex-1 min-w-0 ml-2">
          <p
            className={`text-sm truncate ${course ? 'text-blue-600 cursor-pointer hover:underline' : 'text-gray-800'}`}
            onClick={() => { if (course) setDetailCourse(course); }}
          >
            {course?.name ?? courseRef.courseName ?? id}
          </p>
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {seasonBadge && (
              <span className="text-xs leading-none" title={seasonBadge.title}>{seasonBadge.emoji}</span>
            )}
            {showsEnglishBadge && (
              <span className="text-xs bg-sky-50 text-sky-600 px-1 py-0.5 rounded font-semibold leading-none" title="קורס באנגלית">
                EN
              </span>
            )}
            {isCoreLockedCourse && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-semibold leading-none" title="קורס נספר כליבה ולא מוקצה לשרשרת">
                ליבה
              </span>
            )}
            {!isCoreLockedCourse && isAssignedHere && isManuallyAssignedHere && (
              <span className="text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded font-semibold leading-none">
                ✓ מוקצה לכאן
              </span>
            )}
            {!isCoreLockedCourse && isAssignedHere && !isManuallyAssignedHere && (
              <span className="text-xs bg-green-50 text-green-700 px-1 py-0.5 rounded font-semibold leading-none" title="שרשרת יחידה — שיבוץ אוטומטי">
                בתוכנית
              </span>
            )}
            {!isCoreLockedCourse && isAssignedElsewhere && (
              <span
                className="text-xs bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded font-semibold leading-none"
                title={`מוקצה ל-${assignedElsewhereName}`}
              >
                מוקצה ל-{assignedElsewhereName}
              </span>
            )}
            {!isCoreLockedCourse && isChainEligible && !effectiveAssignment && (
              <span className="text-xs bg-amber-50 text-amber-600 px-1 py-0.5 rounded font-semibold leading-none" title="קורס שייך למספר שרשראות — יש לשבץ ידנית">
                לא שובץ
              </span>
            )}
            {isNotCountedHere && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1 py-0.5 rounded font-semibold leading-none">
                לא נספר
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{id} · {course?.credits ?? '?'} נק"ז</p>
        </div>
        <div className="flex items-center gap-1.5">
          {showAssignButton && (
            isManuallyAssignedHere ? (
              <button
                onClick={() => setCourseChainAssignment(id, null)}
                className="text-xs px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600 transition-colors leading-none"
                title="בטל הקצאה"
              >
                ✓ מוקצה
              </button>
            ) : (
              <button
                onClick={() => setCourseChainAssignment(id, group.id)}
                className="text-xs px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors leading-none"
                title={isCoreLockedCourse ? 'הקצה לשרשרת זו — ישחרר מספירת ליבה' : 'הקצה קורס זה לשרשרת זו בלבד'}
              >
                הקצה
              </button>
            )
          )}
          <button
            onClick={() => toggleFavorite(id)}
            className={`text-lg leading-none ${isFav ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
            title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          >
            {isFav ? '★' : '☆'}
          </button>
          {!isInPlan && (
            <button
              onClick={() => addCourseToSemester(id, 0)}
              className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-1.5 py-0.5 rounded transition-colors"
              title="הוסף ללא משובץ"
            >
              +
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderRuleBlock = (block: SpecializationRuleBlock) => (
    <section
      key={block.id}
      className={`rounded-xl border p-3 ${
        block.isSatisfied ? 'border-green-200 bg-green-50/70' : 'border-amber-200 bg-amber-50/70'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="text-right">
          <h3 className="text-sm font-semibold text-gray-900">{block.title}</h3>
          {block.note && <p className="text-xs text-gray-500 mt-0.5">{block.note}</p>}
        </div>
        <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${
          block.isSatisfied ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
        }`}>
          {summarizeBlock(block)}
        </span>
      </div>
      <div className="space-y-0.5">
        {block.options.map(renderCourse)}
      </div>
    </section>
  );

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="text-right">
            <h2 className="font-bold text-gray-900">{group.name}</h2>
            <div className="flex items-center justify-end gap-2 mt-1 text-xs text-gray-500">
              {mode === 'double' && (
                <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">כפולה</span>
              )}
              <span>{evaluation.doneCount}/{evaluation.requiredCount} קורסים</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="סגור"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <div className="flex flex-wrap gap-2 justify-end">
            {evaluation.ruleBlocks.map((block) => (
              <span
                key={block.id}
                className={`text-xs px-2 py-1 rounded-full ${
                  block.isSatisfied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {summarizeBlock(block)}
              </span>
            ))}
          </div>

          {evaluation.ruleBlocks.map(renderRuleBlock)}

          {extraCourses.length > 0 && (
            <section className="rounded-xl border border-gray-200 p-3">
              <div className="mb-2 text-right">
                <h3 className="text-sm font-semibold text-gray-900">קורסים נוספים בקבוצה</h3>
                <p className="text-xs text-gray-500 mt-0.5">קורסים ששייכים לקבוצה אך אינם מופיעים ישירות בחוקי החובה.</p>
              </div>
              <div className="space-y-0.5">
                {extraCourses.map(renderCourse)}
              </div>
            </section>
          )}

          {group.notes.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 text-right">הערות</h3>
              <ul className="space-y-1 text-xs text-gray-600 text-right">
                {group.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          )}

          {(group.replacementRules.length > 0 || group.mutualExclusionRules.length > 0) && (
            <section className="rounded-xl border border-gray-200 p-3 space-y-2">
              {group.replacementRules.length > 0 && (
                <div className="text-right">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">כללי החלפה</h3>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {group.replacementRules.map((rule) => (
                      <li key={`${rule.replaceableCourse.courseNumber}-${rule.allowedReplacements.map((course) => course.courseNumber).join('-')}`}>
                        {rule.replaceableCourse.courseName} יכולה להיות מוחלפת ב-{rule.allowedReplacements.map((course) => course.courseName).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {group.mutualExclusionRules.length > 0 && (
                <div className="text-right">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">מגבלות בחירה</h3>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {group.mutualExclusionRules.map((rule) => (
                      <li key={`${rule.type}-${rule.options.map((option) => option.courseNumber).join('-')}`}>
                        {rule.note ?? `מותר לבחור עד ${rule.count} מתוך ${rule.options.map((option) => option.courseName).join(', ')}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
      {detailCourse && (
        <CourseDetailModal
          course={detailCourse}
          courses={courses}
          elevated
          onClose={() => setDetailCourse(null)}
        />
      )}
    </div>,
    document.body,
  );
}
