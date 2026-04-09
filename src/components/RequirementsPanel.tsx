import { useState } from 'react';
import { usePlanStore } from '../store/planStore';
import type { GeneralRequirementProgress } from '../domain/generalRequirements/types';
import { isManualEnglishEligible } from '../data/generalRequirements/courseClassification';

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
}

function formatRequirementValue(req: GeneralRequirementProgress, targetValue: number): string {
  const unit = req.targetUnit === 'credits' ? 'נק"ז' : 'קורסים';
  const completed = req.completedValue % 1 === 0 ? req.completedValue : req.completedValue.toFixed(1);
  return `${completed} / ${targetValue} ${unit}`;
}

function CompactRequirementRow({
  req,
  targetValue = req.targetValue,
  missingValue = req.missingValue,
  manualEnglishCourseIds,
  englishTaughtCourses,
  onToggleEnglishCourse,
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
            <span className="text-sm font-medium text-gray-800">{req.title}</span>
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

      {req.countedCourses.length > 0 && (
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
    specializationGroups: { completed: number; required: number; total: number };
    groupDetails: { id: string; name: string; done: number; min: number; isDouble?: boolean }[];
    sport: { earned: number; required: number };
    general: { earned: number; required: number };
    generalRequirements: GeneralRequirementProgress[];
    labPoolProgress: { earned: number; required: number; mandatory: boolean; max?: number } | null;
    english: {
      placed: { id: string; name: string }[];
      hasExemption: boolean;
      score?: number;
      requirements: { label: string; done: boolean }[];
      taughtCourses: string[];
      englishInPlan: string[];
    };
    isReady: boolean;
  } | null;
  weightedAverage: number | null;
}

export function RequirementsPanel({ progress, weightedAverage }: Props) {
  const { setMiluimCredits, setEnglishScore, toggleEnglishTaughtCourse } = usePlanStore();
  const miluimCredits = usePlanStore((s) => s.miluimCredits);
  const englishScore = usePlanStore((s) => s.englishScore);
  const englishTaughtCourses = usePlanStore((s) => s.englishTaughtCourses ?? []);
  const [miluimInput, setMiluimInput] = useState<string>(miluimCredits?.toString() ?? '');
  if (!progress) return null;

  const isMiluim = miluimCredits !== undefined;
  const englishOk = progress.english.requirements.length > 0
    ? progress.english.requirements.every((requirement) => requirement.done)
    : progress.english.placed.length > 0;
  const compactRequirements = progress.generalRequirements.filter((req) => (
    req.requirementId === 'melag' ||
    req.requirementId === 'english' ||
    req.requirementId === 'sport' ||
    req.requirementId === 'labs'
  ));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-base font-bold text-gray-900 mb-4">מעקב דרישות</h2>
      {progress.isReady && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-4 text-center">
          <p className="text-green-700 font-semibold text-sm">עמדת בכל הדרישות!</p>
        </div>
      )}

      <ProgressRow label="קורסי חובה" earned={progress.mandatory.earned} required={progress.mandatory.required} color="bg-blue-500" />
      <ProgressRow label="קורסי בחירה" earned={progress.elective.earned} required={progress.elective.required} color="bg-purple-500" />
      <ProgressRow label='סה"כ נקודות' earned={progress.total.earned} required={progress.total.required} color="bg-gray-400" />
      <div className="mb-2 flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isMiluim}
            onChange={(e) => {
              if (e.target.checked) {
                setMiluimCredits(0);
                setMiluimInput('0');
              } else {
                setMiluimCredits(null);
                setMiluimInput('');
              }
            }}
            className="rounded"
          />
          מילואים
        </label>
        {isMiluim && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={10}
              value={miluimInput}
              onChange={(e) => {
                setMiluimInput(e.target.value);
                const parsed = parseInt(e.target.value, 10);
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
          <span className={`text-sm font-bold ${progress.specializationGroups.completed >= progress.specializationGroups.required ? 'text-green-600' : 'text-gray-600'}`}>
            {progress.specializationGroups.completed} / {progress.specializationGroups.required}
            {progress.specializationGroups.completed >= progress.specializationGroups.required ? ' הושלם' : ''}
          </span>
        </div>
        {progress.groupDetails.length > 0 && (
          <div className="space-y-1 pr-1">
            {progress.groupDetails.map((group) => (
              <div key={group.id} className="flex justify-between items-center">
                <span className="text-xs text-gray-500 truncate max-w-[120px]" title={group.name}>{group.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {group.isDouble && <span className="text-xs bg-purple-100 text-purple-600 px-1 rounded font-medium">כפול</span>}
                  <span className={`text-xs font-medium ${group.done >= group.min ? 'text-green-600' : 'text-gray-500'}`}>
                    {group.done}/{group.min}{group.done >= group.min ? ' הושלם' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700">אנגלית</span>
            {englishOk && <span className="text-xs text-green-600 font-bold">הושלם</span>}
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs text-gray-500 shrink-0">ניקוד אמיר"ם:</span>
            <input
              type="number"
              min={104}
              max={150}
              value={englishScore ?? ''}
              onChange={(e) => {
                const nextValue = e.target.value === '' ? null : parseInt(e.target.value, 10);
                setEnglishScore(nextValue);
              }}
              placeholder="104-150"
              className="w-20 text-xs border border-gray-300 rounded px-1.5 py-0.5 text-center"
            />
          </div>
          {progress.english.requirements.length > 0 && (
            <div className="space-y-0.5 pr-1">
              {progress.english.requirements.map((requirement, index) => (
                <div key={index} className="flex items-center gap-1">
                  <span className={`text-xs font-bold ${requirement.done ? 'text-green-600' : 'text-gray-400'}`}>
                    {requirement.done ? '✓' : '○'}
                  </span>
                  <span className={`text-xs ${requirement.done ? 'text-green-700' : 'text-gray-500'}`}>{requirement.label}</span>
                </div>
              ))}
            </div>
          )}
          {progress.english.score === undefined && (
            <p className="text-xs text-gray-400">הזן ניקוד אמיר"ם לקביעת דרישות</p>
          )}
        </div>

        <div className="space-y-2 pt-1">
          {compactRequirements.map((req) => {
            const manualEnglishCourseIds = req.requirementId === 'melag'
              ? req.countedCourses
                .filter((course) => isManualEnglishEligible(course.courseId))
                .map((course) => course.courseId)
              : [];

            return (
              <CompactRequirementRow
                key={req.requirementId}
                req={req}
                targetValue={req.requirementId === 'melag' ? progress.general.required : undefined}
                missingValue={req.requirementId === 'melag'
                  ? Math.max(0, progress.general.required - req.completedValue)
                  : undefined}
                manualEnglishCourseIds={manualEnglishCourseIds}
                englishTaughtCourses={englishTaughtCourses}
                onToggleEnglishCourse={toggleEnglishTaughtCourse}
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
}
