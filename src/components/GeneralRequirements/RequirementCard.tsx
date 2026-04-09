import type { GeneralRequirementProgress } from '../../domain/generalRequirements/types';
import { usePlanStore } from '../../store/planStore';

const STATUS_STYLES = {
  completed: 'bg-green-50 border-green-200',
  partial: 'bg-yellow-50 border-yellow-200',
  missing: 'bg-red-50 border-red-200',
  unknown: 'bg-gray-50 border-gray-200',
} as const;

const STATUS_BADGE = {
  completed: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  missing: 'bg-red-100 text-red-600',
  unknown: 'bg-gray-100 text-gray-500',
} as const;

const STATUS_LABEL = {
  completed: '✓ הושלם',
  partial: 'חלקי',
  missing: 'חסר',
  unknown: 'לא ידוע',
} as const;

const PROGRESS_BAR_COLOR = {
  completed: 'bg-green-500',
  partial: 'bg-yellow-400',
  missing: 'bg-red-300',
  unknown: 'bg-gray-300',
} as const;

interface Props {
  req: GeneralRequirementProgress;
}

// Courses in the מל"גים category that are only SOMETIMES taught in English — user can toggle manually
const SOMETIMES_ENGLISH_MELAG_COURSES: Record<string, string> = {
  '03240527': 'יסודות היזמות', // sometimes in English, sometimes not
};

export function RequirementCard({ req }: Props) {
  const { englishTaughtCourses, toggleEnglishTaughtCourse } = usePlanStore();
  const pct = Math.min(100, req.targetValue > 0 ? (req.completedValue / req.targetValue) * 100 : 0);
  const unitLabel = req.targetUnit === 'credits' ? 'נ״ז' : 'קורסים';

  return (
    <div className={`rounded-xl border p-3 ${STATUS_STYLES[req.status]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800">{req.title}</span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${STATUS_BADGE[req.status]}`}>
          {STATUS_LABEL[req.status]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
        <div
          className={`h-1.5 rounded-full transition-all ${PROGRESS_BAR_COLOR[req.status]}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-500">
          {req.completedValue % 1 === 0 ? req.completedValue : req.completedValue.toFixed(1)}
          {' / '}
          {req.targetValue} {unitLabel}
        </span>
        {req.missingValue > 0 && (
          <span className="text-xs text-red-500 font-medium">
            חסר: {req.missingValue % 1 === 0 ? req.missingValue : req.missingValue.toFixed(1)} {unitLabel}
          </span>
        )}
      </div>

      {/* Counted courses */}
      {req.countedCourses.length > 0 && (
        <div className="space-y-0.5">
          {req.countedCourses.map((c) => (
            <div key={c.courseId} className="flex justify-between items-center text-xs text-gray-600">
              <span className="truncate max-w-[150px]" title={c.name}>{c.name}</span>
              <span className="shrink-0 text-gray-400 ml-1">
                {c.countedValue % 1 === 0 ? c.countedValue : c.countedValue.toFixed(1)}{' '}
                {req.targetUnit === 'credits' ? 'נ״ז' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Manual English toggle for מל"גים courses that are only sometimes taught in English */}
      {req.type === 'MELAG' && req.countedCourses
        .filter((c) => SOMETIMES_ENGLISH_MELAG_COURSES[c.courseId] !== undefined)
        .map((c) => (
          <label key={c.courseId} className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer mt-1.5 select-none">
            <input
              type="checkbox"
              checked={(englishTaughtCourses ?? []).includes(c.courseId)}
              onChange={() => toggleEnglishTaughtCourse(c.courseId)}
              className="rounded"
            />
            {c.name} — נלמד באנגלית (ספור כקורס אנגלית)
          </label>
        ))
      }
    </div>
  );
}
