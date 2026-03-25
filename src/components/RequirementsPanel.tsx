import { usePlanStore } from '../store/planStore';

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
    sport: { earned: number; required: number };
    general: { earned: number; required: number };
    labs: { id: string; name: string; done: boolean }[];
    english: { placed: { id: string; name: string }[]; hasExemption: boolean };
    isReady: boolean;
  } | null;
  weightedAverage: number | null;
}

export function RequirementsPanel({ progress, weightedAverage }: Props) {
  const { toggleEnglishExemption } = usePlanStore();
  if (!progress) return null;

  const englishOk = progress.english.hasExemption || progress.english.placed.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-base font-bold text-gray-900 mb-4">מעקב דרישות</h2>
      {progress.isReady && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-4 text-center">
          <p className="text-green-700 font-semibold text-sm">🎓 עמדת בכל הדרישות!</p>
        </div>
      )}
      <ProgressRow label="קורסי חובה" earned={progress.mandatory.earned} required={progress.mandatory.required} color="bg-blue-500" />
      <ProgressRow label="קורסי בחירה" earned={progress.elective.earned} required={progress.elective.required} color="bg-purple-500" />
      <ProgressRow label="סה״כ נקודות" earned={progress.total.earned} required={progress.total.required} color="bg-gray-400" />
      <ProgressRow label="מל״גים" earned={progress.general.earned} required={progress.general.required} color="bg-yellow-400" />
      <ProgressRow label="ספורט" earned={progress.sport.earned} required={progress.sport.required} color="bg-green-400" />

      <div className="border-t pt-3 mt-1 space-y-2">
        {/* Specialization groups */}
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

        {/* Labs checklist */}
        {progress.labs.length > 0 && (
          <div>
            <p className="text-sm text-gray-700 mb-1">מעבדות</p>
            <div className="space-y-0.5 pr-1">
              {progress.labs.map(lab => (
                <div key={lab.id} className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${lab.done ? 'text-green-600' : 'text-gray-400'}`}>
                    {lab.done ? '✓' : '○'}
                  </span>
                  <span className={`text-xs truncate ${lab.done ? 'text-green-700' : 'text-gray-500'}`} title={lab.name}>
                    {lab.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* English */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-700">אנגלית</span>
            {progress.english.placed.length > 0 && (
              <div className="space-y-0.5 pr-1 mt-0.5">
                {progress.english.placed.map(c => (
                  <p key={c.id} className="text-xs text-green-700 truncate">✓ {c.name}</p>
                ))}
              </div>
            )}
            {progress.english.placed.length === 0 && !progress.english.hasExemption && (
              <p className="text-xs text-gray-400 mt-0.5">לא נמצאו קורסי אנגלית</p>
            )}
          </div>
          <button
            onClick={toggleEnglishExemption}
            className={`shrink-0 text-xs px-1.5 py-0.5 rounded border transition-colors ${
              progress.english.hasExemption
                ? 'bg-green-100 border-green-300 text-green-700'
                : 'border-gray-200 text-gray-400 hover:border-gray-300'
            }`}
            title={progress.english.hasExemption ? 'בטל פטור' : 'סמן כפטור'}
          >
            {progress.english.hasExemption ? '✓ פטור' : 'פטור?'}
          </button>
          {englishOk && !progress.english.hasExemption && (
            <span className="shrink-0 text-xs text-green-600 font-bold">✓</span>
          )}
        </div>

        {/* Weighted average */}
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
