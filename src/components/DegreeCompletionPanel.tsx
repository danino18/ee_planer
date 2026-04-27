import { memo } from 'react';
import type { DegreeCompletionResult, DegreeRequirementCheck } from '../domain/degreeCompletion';

interface Props {
  result: DegreeCompletionResult | null;
}

const UNIT_LABELS: Record<string, string> = {
  credits: 'נק"ז',
  courses: 'קורסים',
  groups: 'קבוצות',
};

function CheckRow({ check }: { check: DegreeRequirementCheck }) {
  const pct = Math.min(100, check.required > 0 ? (check.earned / check.required) * 100 : 100);
  const unit = UNIT_LABELS[check.unit] ?? check.unit;

  const iconColor =
    check.status === 'completed'
      ? 'text-green-600'
      : check.status === 'partial'
        ? 'text-amber-500'
        : 'text-gray-400';

  const barColor =
    check.status === 'completed'
      ? 'bg-green-500'
      : check.status === 'partial'
        ? 'bg-amber-400'
        : 'bg-gray-200';

  const valueColor =
    check.status === 'completed' ? 'text-green-600' : 'text-gray-600';

  const earned =
    check.earned % 1 === 0 ? check.earned : check.earned.toFixed(1);

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-sm font-bold shrink-0 ${iconColor}`}>
            {check.status === 'completed' ? '✓' : '○'}
          </span>
          <span className="text-sm text-gray-700 truncate">{check.title}</span>
        </div>
        <span className={`text-xs font-semibold shrink-0 ${valueColor}`}>
          {earned} / {check.required} {unit}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export const DegreeCompletionPanel = memo(function DegreeCompletionPanel({ result }: Props) {
  if (!result) return null;

  const completed = result.requirements.filter((r) => r.status === 'completed').length;
  const total = result.requirements.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-base font-bold text-gray-900 mb-3">בדיקת גמר תואר</h2>

      {result.isComplete ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-center">
          <p className="text-green-700 font-bold text-sm">התואר הושלם!</p>
          <p className="text-green-600 text-xs mt-0.5">כל הדרישות עמדו</p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">דרישות שהושלמו</span>
          <span className="text-sm font-bold text-gray-800">{completed} / {total}</span>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {result.requirements.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </div>

      {result.missingRequirements.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">חסר להשלמת התואר:</p>
          <ul className="space-y-0.5">
            {result.missingRequirements.map((r) => (
              <li key={r.id} className="text-xs text-red-600 flex items-center gap-1">
                <span className="font-bold">✗</span>
                <span>
                  {r.title} — חסר {r.missingValue % 1 === 0 ? r.missingValue : r.missingValue.toFixed(1)} {UNIT_LABELS[r.unit] ?? r.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

DegreeCompletionPanel.displayName = 'DegreeCompletionPanel';
