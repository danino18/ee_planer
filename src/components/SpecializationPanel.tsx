import { lazy, Suspense, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SpecializationGroup, SpecializationRuleBlock, SapCourse, TrackSpecializationCatalog } from '../types';
import { evaluateSpecializationGroup } from '../domain/specializations';
import { usePlanStore } from '../store/planStore';

interface Props {
  catalog: TrackSpecializationCatalog;
  courses: Map<string, SapCourse>;
}

const LazySpecializationGroupModal = lazy(async () => {
  const module = await import('./SpecializationGroupModal');
  return { default: module.SpecializationGroupModal };
});

function getRuleProgress(ruleBlocks: SpecializationRuleBlock[]) {
  const required = ruleBlocks.reduce((sum, block) => sum + block.requiredCount, 0);
  const done = ruleBlocks.reduce((sum, block) => sum + Math.min(block.satisfiedCount, block.requiredCount), 0);
  return { done, required };
}

function summarizeRuleBlock(block: SpecializationRuleBlock): string {
  const labels: Record<SpecializationRuleBlock['kind'], string> = {
    mandatory_courses: 'חובה',
    mandatory_choice: 'בחירת חובה',
    selection_rule: 'בחירה',
    additional_courses: 'קורס נוסף',
  };
  return `${block.satisfiedCount}/${block.requiredCount} ${labels[block.kind]}`;
}

export function SpecializationPanel({ catalog, courses }: Props) {
  const {
    selectedSpecializations, semesters, completedCourses,
    toggleSpecialization, doubleSpecializations, toggleDoubleSpecialization,
    courseChainAssignments,
  } = usePlanStore(useShallow((state) => ({
    selectedSpecializations: state.selectedSpecializations,
    semesters: state.semesters,
    completedCourses: state.completedCourses,
    toggleSpecialization: state.toggleSpecialization,
    doubleSpecializations: state.doubleSpecializations,
    toggleDoubleSpecialization: state.toggleDoubleSpecialization,
    courseChainAssignments: state.courseChainAssignments,
  })));
  const groups = catalog.groups;
  const allPlaced = useMemo(
    () => new Set([...completedCourses, ...Object.values(semesters).flat()]),
    [completedCourses, semesters],
  );
  const [openGroup, setOpenGroup] = useState<SpecializationGroup | null>(null);
  const doubles = doubleSpecializations ?? [];
  const interactionDisabled = catalog.interactionDisabled;

  function handleOpenGroup(group: SpecializationGroup) {
    setOpenGroup(group);
  }

  function handleDoubleClick(e: React.MouseEvent, group: SpecializationGroup) {
    e.stopPropagation();
    if (interactionDisabled) return;
    const isSelected = selectedSpecializations.includes(group.id);
    const isDouble = doubles.includes(group.id);
    if (!isSelected) {
      toggleSpecialization(group.id);
      if (!isDouble) toggleDoubleSpecialization(group.id);
      return;
    }
    toggleDoubleSpecialization(group.id);
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-bold text-gray-900 mb-1">התמחויות</h2>
        <p className="text-xs text-gray-400 mb-3">לחץ לפתיחת פרטי הקבוצה</p>
        {catalog.diagnostics.length > 0 && (
          <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
            interactionDisabled
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-gray-200 bg-gray-50 text-gray-600'
          }`}>
            {interactionDisabled
              ? 'קבצי ההתמחויות למסלול הזה מכילים שגיאות. הבחירה והחישוב הושבתו עד לתיקון.'
              : 'נמצאו אזהרות בקבצי ההתמחויות למסלול זה.'}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {groups.map((group) => {
            const isSelected = selectedSpecializations.includes(group.id);
            const isDouble = doubles.includes(group.id);
            const evaluation = evaluateSpecializationGroup(
              group,
              allPlaced,
              isDouble && group.canBeDouble ? 'double' : 'single',
              courseChainAssignments,
            );
            const progress = getRuleProgress(evaluation.ruleBlocks);
            const pct = Math.min(
              100,
              progress.required > 0
                ? (progress.done / progress.required) * 100
                : 0,
            );

            return (
              <div
                key={group.id}
                onClick={() => handleOpenGroup(group)}
                className={`text-right p-3 rounded-lg border-2 transition-all cursor-pointer ${
                  isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!interactionDisabled) toggleSpecialization(group.id);
                      }}
                      disabled={interactionDisabled}
                      className={`text-xs leading-none w-5 h-5 flex items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 text-transparent hover:border-blue-400'
                      } ${interactionDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                      title={isSelected ? 'בטל בחירה' : 'בחר קבוצה'}
                    >
                      ✓
                    </button>
                    {group.canBeDouble && (
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleDoubleClick(e, group)}
                        disabled={interactionDisabled}
                        className={`text-xs leading-none px-1.5 py-0.5 rounded border transition-colors ${
                          isDouble
                            ? 'bg-purple-500 border-purple-500 text-white'
                            : 'border-gray-300 text-gray-400 hover:border-purple-400 hover:text-purple-500'
                        } ${interactionDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        title={isDouble ? 'בטל התמחות כפולה' : 'הגדר כהתמחות כפולה'}
                      >
                        כפ
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {isDouble && <span className="text-xs bg-purple-100 text-purple-600 px-1 rounded font-medium">כפולה</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${evaluation.complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {progress.done}/{progress.required}{evaluation.complete ? ' הושלם' : ''}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 truncate">{group.name}</span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1 mt-2">
                      {evaluation.ruleBlocks.map((block) => (
                        <span
                          key={block.id}
                          className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                            block.isSatisfied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {summarizeRuleBlock(block)}
                        </span>
                      ))}
                    </div>
                    {evaluation.issues.length > 0 && (
                      <p className="text-[11px] text-amber-700 mt-2 line-clamp-2">{evaluation.issues[0]}</p>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${evaluation.complete ? (isDouble ? 'bg-purple-500' : 'bg-green-500') : 'bg-blue-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {openGroup && (
        <Suspense fallback={null}>
          <LazySpecializationGroupModal
            group={openGroup}
            courses={courses}
            onClose={() => setOpenGroup(null)}
          />
        </Suspense>
      )}
    </>
  );
}
