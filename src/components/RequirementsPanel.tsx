import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../store/planStore';
import type { GeneralRequirementProgress } from '../domain/generalRequirements/types';
import { isManualEnglishEligible } from '../data/generalRequirements/courseClassification';
import type { SpecializationDiagnostic } from '../types';
import type { EnglishRequirementItem, CoreSlot } from '../hooks/usePlan';

interface ProgressRowProps {
  label: string;
  earned: number;
  required: number;
  color: string;
}

function ProgressRow({ label, earned, required, color }: ProgressRowProps) {
  const pct = Math.min(100, required > 0 ? (earned / required) * 100 : 0);
  const done = earned >= required;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className={`text-sm font-bold ${done ? 'text-green-600' : 'text-gray-600'}`}>
          {earned.toFixed(1)} / {required} {done ? 'נק"ז' : ''}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface CompactRequirementRowProps {
  req: GeneralRequirementProgress;
  targetValue?: number;
  missingValue?: number;
  manualEnglishCourseIds: string[];
  englishTaughtCourses: string[];
  onToggleEnglishCourse: (courseId: string) => void;
  englishScore?: number;
  onSetEnglishScore?: (score: number | null) => void;
  englishRequirementItems?: EnglishRequirementItem[];
}

function getRequirementDisplayLabel(req: GeneralRequirementProgress): string {
  switch (req.requirementId) {
    case 'free_elective':
      return 'בחירה חופשית';
    case 'general_electives':
      return 'קורסי בחירה כלל טכניונים';
    case 'english':
      return 'קורסים באנגלית';
    case 'sport':
      return 'ספורט / חינוך גופני';
    case 'labs':
      return 'מעבדות';
    default:
      return req.title;
  }
}

function formatRequirementValue(req: GeneralRequirementProgress, targetValue: number): string {
  const unit = req.targetUnit === 'credits' ? 'נק"ז' : 'קורסים';
  const completed = req.completedValue % 1 === 0 ? req.completedValue : req.completedValue.toFixed(1);
  return `${completed} / ${targetValue} ${unit}`;
}

function renderEnglishRequirementText(requirement: EnglishRequirementItem): string {
  if (requirement.kind === 'content_course') {
    if (requirement.courseNames.length === 0) {
      return requirement.neededCount === 2 ? 'חסרים 2 קורסי תוכן באנגלית' : 'חסר קורס תוכן באנגלית';
    }

    if (requirement.neededCount === 2) {
      return requirement.courseNames.length === 2
        ? requirement.courseNames.join(', ')
        : `${requirement.courseNames[0]} + חסר קורס נוסף`;
    }

    return requirement.courseNames[0];
  }

  return requirement.courseNames[0] ?? requirement.label;
}

function CompactRequirementRow({
  req,
  targetValue = req.targetValue,
  missingValue = req.missingValue,
  manualEnglishCourseIds,
  englishTaughtCourses,
  onToggleEnglishCourse,
  englishScore,
  onSetEnglishScore,
  englishRequirementItems,
}: CompactRequirementRowProps) {
  const pct = Math.min(100, targetValue > 0 ? (req.completedValue / targetValue) * 100 : 0);
  const isDone = req.completedValue >= targetValue;
  const missingText = missingValue > 0
    ? `${missingValue % 1 === 0 ? missingValue : missingValue.toFixed(1)} ${req.targetUnit === 'credits' ? 'נק"ז' : 'קורסים'} חסרים`
    : 'הושלם';

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{getRequirementDisplayLabel(req)}</span>
            {isDone && <span className="text-xs font-semibold text-green-600">הושלם</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{missingText}</p>
        </div>
        <span className={`text-xs font-semibold shrink-0 ${isDone ? 'text-green-600' : 'text-gray-600'}`}>
          {formatRequirementValue(req, targetValue)}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
        <div
          className={`h-1.5 rounded-full transition-all ${isDone ? 'bg-green-500' : 'bg-gray-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {req.requirementId === 'english' && onSetEnglishScore && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-500 shrink-0">ניקוד אמיר"ם:</span>
          <input
            type="number"
            min={104}
            max={150}
            value={englishScore ?? ''}
            onChange={(event) => {
              const nextValue = event.target.value === '' ? null : parseInt(event.target.value, 10);
              onSetEnglishScore(nextValue);
            }}
            placeholder="104-150"
            className="w-24 text-xs border border-gray-300 rounded px-1.5 py-0.5 text-center bg-white"
          />
        </div>
      )}

      {req.requirementId === 'english' && (
        <div className="mt-2 space-y-1.5">
          {englishScore === undefined ? (
            <p className="text-xs text-gray-400">הזן ניקוד אמיר"ם כדי לחשב את דרישות האנגלית</p>
          ) : (
            englishRequirementItems?.map((requirement) => (
              <div key={`${req.requirementId}-${requirement.kind}-${requirement.label}`} className="flex items-start gap-2 text-xs">
                <span className={`font-bold mt-0.5 ${requirement.done ? 'text-green-600' : 'text-gray-400'}`}>
                  {requirement.done ? '✓' : '○'}
                </span>
                <div className="min-w-0">
                  <div className={`font-medium ${requirement.done ? 'text-green-700' : 'text-gray-600'}`}>{requirement.label}</div>
                  <div className="text-gray-500 break-words">{renderEnglishRequirementText(requirement)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {req.countedCourses.length > 0 && req.requirementId !== 'english' && (
        <div className="mt-2 flex flex-wrap gap-1">
          {req.countedCourses.map((course) => (
            <span key={`${req.requirementId}-${course.courseId}`} className="text-[11px] rounded-full bg-white border border-gray-200 px-2 py-0.5 text-gray-600">
              {course.name}
            </span>
          ))}
        </div>
      )}

      {manualEnglishCourseIds.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {manualEnglishCourseIds.map((courseId) => {
            const course = req.countedCourses.find((item) => item.courseId === courseId);
            if (!course) return null;

            return (
              <label key={`${req.requirementId}-toggle-${courseId}`} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={englishTaughtCourses.includes(courseId)}
                  onChange={() => onToggleEnglishCourse(courseId)}
                  className="rounded"
                />
                <span>{course.name} נלמד באנגלית</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  progress: {
    mandatory: { earned: number; required: number };
    elective: { earned: number; required: number };
    total: { earned: number; required: number };
    specializationGroups: {
      completed: number;
      required: number;
      total: number;
      unavailable?: boolean;
      diagnostics?: SpecializationDiagnostic[];
    };
    groupDetails: {
      id: string;
      name: string;
      done: number;
      min: number;
      isDouble?: boolean;
      complete?: boolean;
      issues?: string[];
      summaries?: { id: string; label: string; done: number; required: number }[];
    }[];
    sport: { earned: number; required: number };
    general: { earned: number; required: number };
    freeElective: { earned: number; required: number };
    generalRequirements: GeneralRequirementProgress[];
    labPoolProgress: { earned: number; required: number; mandatory: boolean; max?: number } | null;
    coreRequirementProgress: {
      completed: number;
      required: number;
      total: number;
      slots: CoreSlot[];
      canRelease: string[];
    } | null;
    english: {
      placed: { id: string; name: string }[];
      hasExemption: boolean;
      score?: number;
      requirements: EnglishRequirementItem[];
      taughtCourses: string[];
      englishInPlan: string[];
    };
    isReady: boolean;
  } | null;
  weightedAverage: number | null;
}

export const RequirementsPanel = memo(function RequirementsPanel({ progress, weightedAverage }: Props) {
  const {
    setMiluimCredits,
    setEnglishScore,
    toggleEnglishTaughtCourse,
    setCoreToChainOverrides,
    miluimCredits,
    englishTaughtCourses,
    coreToChainOverrides,
  } = usePlanStore(useShallow((state) => ({
    setMiluimCredits: state.setMiluimCredits,
    setEnglishScore: state.setEnglishScore,
    toggleEnglishTaughtCourse: state.toggleEnglishTaughtCourse,
    setCoreToChainOverrides: state.setCoreToChainOverrides,
    miluimCredits: state.miluimCredits,
    englishTaughtCourses: state.englishTaughtCourses ?? [],
    coreToChainOverrides: state.coreToChainOverrides ?? [],
  })));
  const compactRequirements = useMemo(() => (
    (progress?.generalRequirements ?? []).filter((req) => (
      req.requirementId === 'free_elective' ||
      req.requirementId === 'general_electives' ||
      req.requirementId === 'english' ||
      req.requirementId === 'sport' ||
      req.requirementId === 'labs'
    ))
  ), [progress?.generalRequirements]);

  const manualEnglishCourseIdsByRequirement = useMemo(() => {
    const idsByRequirement = new Map<string, string[]>();
    for (const requirement of compactRequirements) {
      if (requirement.requirementId !== 'free_elective') continue;

      idsByRequirement.set(
        requirement.requirementId,
        requirement.countedCourses
          .filter((course) => isManualEnglishEligible(course.courseId))
          .map((course) => course.courseId),
      );
    }
    return idsByRequirement;
  }, [compactRequirements]);

  if (!progress) return null;

  const isMiluim = miluimCredits !== undefined;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-base font-bold text-gray-900 mb-4">מעקב דרישות</h2>
      {progress.isReady && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-4 text-center">
          <p className="text-green-700 font-semibold text-sm">עמדת בכל הדרישות!</p>
        </div>
      )}

      <ProgressRow label="קורסי חובה" earned={progress.mandatory.earned} required={progress.mandatory.required} color="bg-blue-500" />
      <ProgressRow label="קורסי בחירה פקולטית" earned={progress.elective.earned} required={progress.elective.required} color="bg-purple-500" />
      {progress.coreRequirementProgress && (() => {
        const { completed, required, slots, canRelease } = progress.coreRequirementProgress!;
        const done = completed >= required;
        const pct = Math.min(100, required > 0 ? (completed / required) * 100 : 0);
        return (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-800">קורסי ליבה</span>
              <span className={`text-sm font-bold ${done ? 'text-green-600' : 'text-gray-600'}`}>
                {completed} / {required} {done ? 'קורסים ✓' : 'קורסים'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className={`h-2 rounded-full transition-all ${done ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="space-y-1">
              {slots.map((slot) => (
                <div key={slot.ids.join('|')} className="flex items-start gap-1.5 text-xs">
                  <span className={`font-bold mt-0.5 shrink-0 ${slot.done ? 'text-green-600' : slot.released ? 'text-purple-500' : 'text-gray-400'}`}>
                    {slot.done ? '✓' : slot.released ? '↗' : '○'}
                  </span>
                  <div className="min-w-0">
                    <span className={slot.done ? 'text-green-700' : slot.released ? 'text-purple-600' : 'text-gray-500'}>
                      {slot.ids.length > 1
                        ? `${slot.names.join(' / ')} (אחד מהשניים)`
                        : slot.names[0]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {canRelease.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-1.5">שחרור עודף לשרשרת:</p>
                <div className="space-y-1">
                  {canRelease.map((id) => {
                    const isReleased = coreToChainOverrides.includes(id);
                    const slot = slots.find((s) => s.ids.includes(id));
                    const name = slot?.names[slot.ids.indexOf(id)] ?? id;
                    return (
                      <label key={id} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isReleased}
                          onChange={() => {
                            if (isReleased) {
                              setCoreToChainOverrides(coreToChainOverrides.filter((x) => x !== id));
                            } else {
                              setCoreToChainOverrides([...coreToChainOverrides, id]);
                            }
                          }}
                          className="rounded"
                        />
                        <span>{name} → לשרשרת</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}
      <ProgressRow label={'סה"כ נקודות'} earned={progress.total.earned} required={progress.total.required} color="bg-gray-400" />

      <div className="mb-2 flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isMiluim}
            onChange={(event) => {
              if (event.target.checked) {
                setMiluimCredits(0);
              } else {
                setMiluimCredits(null);
              }
            }}
            className="rounded"
          />
          מילואים
        </label>
        {isMiluim && (
          <div className="flex items-center gap-1">
            <input
              key={miluimCredits ?? 'empty'}
              type="number"
              min={0}
              max={10}
              defaultValue={miluimCredits ?? ''}
              onChange={(event) => {
                const parsed = parseInt(event.target.value, 10);
                if (!Number.isNaN(parsed)) setMiluimCredits(parsed);
              }}
              className="w-14 text-xs border border-gray-300 rounded px-1.5 py-0.5 text-center"
              placeholder="0-10"
            />
            <span className="text-xs text-gray-400">נק"ז</span>
          </div>
        )}
      </div>

      <div className="border-t pt-3 mt-1 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700">קבוצות התמחות</span>
          <span className={`text-sm font-bold ${
            progress.specializationGroups.unavailable
              ? 'text-amber-700'
              : progress.specializationGroups.completed >= progress.specializationGroups.required
                ? 'text-green-600'
                : 'text-gray-600'
          }`}>
            {progress.specializationGroups.unavailable ? 'לא זמין' : `${progress.specializationGroups.completed} / ${progress.specializationGroups.required}`}
            {progress.specializationGroups.completed >= progress.specializationGroups.required ? ' הושלם' : ''}
          </span>
        </div>
        {progress.specializationGroups.unavailable && (
          <p className="text-xs text-amber-700">
            קבצי ההתמחויות למסלול הזה אינם תקינים כרגע ולכן ההתקדמות בהתמחויות לא מחושבת.
          </p>
        )}
        {progress.groupDetails.length > 0 && (
          <div className="space-y-1 pr-1">
            {progress.groupDetails.map((group) => (
              <div key={group.id}>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 truncate max-w-[120px]" title={group.name}>{group.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {group.isDouble && <span className="text-xs bg-purple-100 text-purple-600 px-1 rounded font-medium">כפול</span>}
                    <span className={`text-xs font-medium ${group.done >= group.min ? 'text-green-600' : 'text-gray-500'}`}>
                      {group.done}/{group.min}{group.done >= group.min ? ' הושלם' : ''}
                    </span>
                  </div>
                </div>
                {group.summaries && group.summaries.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1 mt-1">
                    {group.summaries.map((summary) => (
                      <span key={summary.id} className="text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {summary.done}/{summary.required} {summary.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-1">
          {compactRequirements.map((req) => {
            const manualEnglishCourseIds = manualEnglishCourseIdsByRequirement.get(req.requirementId) ?? [];

            return (
              <CompactRequirementRow
                key={req.requirementId}
                req={req}
                targetValue={
                  req.requirementId === 'free_elective'
                    ? progress.freeElective.required
                    : req.requirementId === 'general_electives'
                    ? progress.general.required
                    : req.requirementId === 'english'
                      ? req.targetValue
                      : undefined
                }
                missingValue={
                  req.requirementId === 'free_elective'
                    ? Math.max(0, progress.freeElective.required - req.completedValue)
                    : req.requirementId === 'general_electives'
                    ? Math.max(0, progress.general.required - req.completedValue)
                    : req.requirementId === 'english'
                      ? Math.max(0, req.targetValue - req.completedValue)
                      : undefined
                }
                manualEnglishCourseIds={manualEnglishCourseIds}
                englishTaughtCourses={englishTaughtCourses}
                onToggleEnglishCourse={toggleEnglishTaughtCourse}
                englishScore={req.requirementId === 'english' ? progress.english.score : undefined}
                onSetEnglishScore={req.requirementId === 'english' ? setEnglishScore : undefined}
                englishRequirementItems={req.requirementId === 'english' ? progress.english.requirements : undefined}
              />
            );
          })}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700">ממוצע משוקלל</span>
          <span className="text-sm font-bold text-gray-800">
            {weightedAverage !== null ? weightedAverage.toFixed(1) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
});

RequirementsPanel.displayName = 'RequirementsPanel';
