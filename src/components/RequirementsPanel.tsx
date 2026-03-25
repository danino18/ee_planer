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
          {earned.toFixed(1)} / {required} {done ? '✓' : ''}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
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
    isReady: boolean;
  } | null;
  weightedAverage: number | null;
}

export function RequirementsPanel({ progress, weightedAverage }: Props) {
  if (!progress) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-20">
      <h2 className="text-base font-bold text-gray-900 mb-4">מעקב דרישות</h2>
      {progress.isReady && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-4 text-center">
          <p className="text-green-700 font-semibold text-sm">🎓 עמדת בכל הדרישות!</p>
        </div>
      )}
      <ProgressRow label="קורסי חובה" earned={progress.mandatory.earned} required={progress.mandatory.required} color="bg-blue-500" />
      <ProgressRow label="קורסי בחירה" earned={progress.elective.earned} required={progress.elective.required} color="bg-purple-500" />
      <ProgressRow label="סה״כ נקודות" earned={progress.total.earned} required={progress.total.required} color="bg-gray-400" />
      <div className="border-t pt-3 mt-1 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700">קבוצות התמחות</span>
          <span className={`text-sm font-bold ${progress.specializationGroups.completed >= progress.specializationGroups.required ? 'text-green-600' : 'text-gray-600'}`}>
            {progress.specializationGroups.completed} / {progress.specializationGroups.required}
            {progress.specializationGroups.completed >= progress.specializationGroups.required ? ' ✓' : ''}
          </span>
        </div>
        {progress.groupDetails.length > 0 && (
          <div className="space-y-1 pr-1">
            {progress.groupDetails.map(g => (
              <div key={g.id} className="flex justify-between items-center">
                <span className="text-xs text-gray-500 truncate max-w-[120px]" title={g.name}>{g.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {g.isDouble && <span className="text-xs bg-purple-100 text-purple-600 px-1 rounded font-medium">כ׳</span>}
                  <span className={`text-xs font-medium ${g.done >= g.min ? 'text-green-600' : 'text-gray-500'}`}>
                    {g.done}/{g.min}{g.done >= g.min ? ' ✓' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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
