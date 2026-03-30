import { useState } from 'react';
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
    labPoolProgress: { earned: number; required: number } | null;
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
  const { setMiluimCredits, setEnglishScore } = usePlanStore();
  const miluimCredits = usePlanStore((s) => s.miluimCredits);
  const englishScore = usePlanStore((s) => s.englishScore);
  const [miluimInput, setMiluimInput] = useState<string>(miluimCredits?.toString() ?? '');
  if (!progress) return null;

  const isMiluim = miluimCredits !== undefined;
  const englishOk = progress.english.requirements.length > 0
    ? progress.english.requirements.every((r) => r.done)
    : progress.english.placed.length > 0;

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
      {/* מל"גים + מילואים */}
      <ProgressRow label="מל״גים" earned={progress.general.earned} required={progress.general.required} color="bg-yellow-400" />
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
                const n = parseInt(e.target.value);
                if (!isNaN(n)) setMiluimCredits(n);
              }}
              className="w-14 text-xs border border-gray-300 rounded px-1.5 py-0.5 text-center"
              placeholder="0–10"
            />
            <span className="text-xs text-gray-400">נ״ז</span>
          </div>
        )}
      </div>
      <ProgressRow label="ספורט" earned={progress.sport.earned} required={progress.sport.required} color="bg-green-400" />
      {progress.labPoolProgress && (
        <ProgressRow label="מעבדות בחירה" earned={progress.labPoolProgress.earned} required={progress.labPoolProgress.required} color="bg-cyan-500" />
      )}

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

        {/* English */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700">אנגלית</span>
            {englishOk && (
              <span className="text-xs text-green-600 font-bold">✓</span>
            )}
          </div>
          {/* Amiram score input */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs text-gray-500 shrink-0">ניקוד אמיר״ם:</span>
            <input
              type="number"
              min={104}
              max={150}
              value={englishScore ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : parseInt(e.target.value);
                setEnglishScore(v);
              }}
              placeholder="104–150"
              className="w-20 text-xs border border-gray-300 rounded px-1.5 py-0.5 text-center"
            />
          </div>
          {/* Requirements based on score */}
          {progress.english.requirements.length > 0 && (
            <div className="space-y-0.5 pr-1">
              {progress.english.requirements.map((req, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className={`text-xs font-bold ${req.done ? 'text-green-600' : 'text-gray-400'}`}>
                    {req.done ? '✓' : '○'}
                  </span>
                  <span className={`text-xs ${req.done ? 'text-green-700' : 'text-gray-500'}`}>{req.label}</span>
                </div>
              ))}
            </div>
          )}
          {progress.english.score === undefined && (
            <p className="text-xs text-gray-400">הזן ניקוד אמיר״ם לבקעת דרישות</p>
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
