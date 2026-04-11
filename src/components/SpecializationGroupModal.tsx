import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import type { SpecializationCourseReference, SpecializationGroup, SpecializationRuleBlock, SapCourse } from '../types';
import { evaluateSpecializationGroup } from '../domain/specializations';
import { usePlanStore } from '../store/planStore';
import { isCourseTaughtInEnglish } from '../data/generalRequirements/courseClassification';

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
  } = usePlanStore(useShallow((state) => ({
    favorites: state.favorites,
    toggleFavorite: state.toggleFavorite,
    semesters: state.semesters,
    completedCourses: state.completedCourses,
    addCourseToSemester: state.addCourseToSemester,
    englishTaughtCourses: state.englishTaughtCourses ?? [],
    doubleSpecializations: state.doubleSpecializations ?? [],
  })));
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const allPlaced = useMemo(
    () => new Set([...completedCourses, ...Object.values(semesters).flat()]),
    [completedCourses, semesters],
  );
  const mode = group.canBeDouble && doubleSpecializations.includes(group.id) ? 'double' : 'single';
  const evaluation = useMemo(
    () => evaluateSpecializationGroup(group, allPlaced, mode),
    [allPlaced, group, mode],
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
    const inPlan = allPlaced.has(id);
    const isFav = favoriteSet.has(id);
    const showsEnglishBadge = course ? isCourseTaughtInEnglish(course, englishTaughtCourses) : false;
    const seasonLabel = course?.teachingSemester === 'winter'
      ? 'חורף'
      : course?.teachingSemester === 'spring'
        ? 'אביב'
        : null;
    return (
      <div key={id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
        <div className="flex-1 min-w-0 ml-2">
          <p className="text-sm text-gray-800 truncate">{course?.name ?? courseRef.courseName ?? id}</p>
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {seasonLabel && (
              <span className="text-[11px] leading-none text-gray-400">{seasonLabel}</span>
            )}
            {showsEnglishBadge && (
              <span className="text-xs bg-sky-50 text-sky-600 px-1 py-0.5 rounded font-semibold leading-none" title="קורס באנגלית">
                EN
              </span>
            )}
            {inPlan && (
              <span className="text-xs bg-green-50 text-green-700 px-1 py-0.5 rounded font-semibold leading-none">
                בתוכנית
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{id} · {course?.credits ?? '?'} נק"ז</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleFavorite(id)}
            className={`text-lg leading-none ${isFav ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
            title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          >
            {isFav ? '★' : '☆'}
          </button>
          {!inPlan && (
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
    </div>,
    document.body,
  );
}
