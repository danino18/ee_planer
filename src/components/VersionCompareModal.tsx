import { useMemo, useState } from 'react';
import type { SapCourse, TrackDefinition, PlanVersion } from '../types';
import { getTrackSpecializationCatalog } from '../domain/specializations';
import { computeWeightedAverage, computeRequirementsProgress } from '../hooks/usePlan';

interface Props {
  versions: PlanVersion[];
  courses: Map<string, SapCourse>;
  trackDefs: TrackDefinition[];
  onClose: () => void;
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function VersionColumn({ version, courses, trackDefs }: { version: PlanVersion; courses: Map<string, SapCourse>; trackDefs: TrackDefinition[] }) {
  const plan = version.plan;
  const trackDef = trackDefs.find((t) => t.id === plan.trackId) ?? null;
  const catalog = plan.trackId ? getTrackSpecializationCatalog(plan.trackId) : null;

  const weightedAverage = useMemo(
    () => computeWeightedAverage(plan.grades ?? {}, courses),
    [plan.grades, courses],
  );

  const progress = useMemo(() => {
    if (!trackDef || !catalog) return null;
    return computeRequirementsProgress(
      {
        semesters: plan.semesters,
        completedCourses: plan.completedCourses,
        selectedSpecializations: plan.selectedSpecializations,
        doubleSpecializations: plan.doubleSpecializations ?? [],
        hasEnglishExemption: plan.hasEnglishExemption ?? false,
        miluimCredits: plan.miluimCredits ?? 0,
        englishScore: plan.englishScore,
        englishTaughtCourses: plan.englishTaughtCourses ?? [],
        semesterOrder: plan.semesterOrder,
        coreToChainOverrides: plan.coreToChainOverrides ?? [],
        roboticsMinorEnabled: plan.roboticsMinorEnabled ?? false,
        entrepreneurshipMinorEnabled: plan.entrepreneurshipMinorEnabled ?? false,
      },
      courses,
      trackDef,
      catalog,
      weightedAverage,
    );
  }, [plan, trackDef, catalog, courses, weightedAverage]);

  // Build semester list from semesterOrder
  const semesterOrder = plan.semesterOrder ?? [];
  const semesters = plan.semesters ?? {};

  const SEM_LABELS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'", "ח'", "ט'", "י'", 'י"א', 'י"ב', 'י"ג', 'י"ד', 'ט"ו', 'ט"ז'];

  return (
    <div className="flex-1 min-w-0 border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="font-semibold text-gray-800 text-sm truncate">{version.name}</div>
        {trackDef && <div className="text-xs text-gray-500">{trackDef.name}</div>}
        {weightedAverage !== null && (
          <div className="text-xs text-gray-500">ממוצע: {weightedAverage.toFixed(2)}</div>
        )}
      </div>

      {/* Requirements */}
      {progress && (
        <div className="px-3 pt-3 pb-2 border-b border-gray-100">
          <div className="text-xs font-semibold text-gray-500 mb-2">דרישות</div>
          {[
            { label: 'חובה', earned: progress.mandatory.earned, required: progress.mandatory.required, color: 'bg-blue-500' },
            { label: 'בחירה', earned: progress.elective.earned, required: progress.elective.required, color: 'bg-emerald-500' },
            { label: 'סה"כ', earned: progress.total.earned, required: progress.total.required, color: 'bg-gray-500' },
          ].map(({ label, earned, required, color }) => (
            <div key={label} className="mb-2">
              <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                <span>{label}</span>
                <span className={earned >= required ? 'text-green-600 font-medium' : ''}>
                  {earned.toFixed(0)} / {required}
                </span>
              </div>
              <ProgressBar pct={required > 0 ? (earned / required) * 100 : 0} color={color} />
            </div>
          ))}
          <div className="text-xs text-gray-600 mt-1">
            התמחויות: {progress.specializationGroups.completed} / {progress.specializationGroups.required}
          </div>
        </div>
      )}

      {/* Specializations */}
      {plan.selectedSpecializations?.length > 0 && (
        <div className="px-3 pt-2 pb-2 border-b border-gray-100">
          <div className="text-xs font-semibold text-gray-500 mb-1">התמחויות נבחרות</div>
          <div className="flex flex-wrap gap-1">
            {plan.selectedSpecializations.map((id) => {
              const group = catalog?.groups.find((g) => g.id === id);
              const isDouble = plan.doubleSpecializations?.includes(id);
              return (
                <span key={id} className="text-xs bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5">
                  {group?.name ?? id}{isDouble ? ' ×2' : ''}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Semesters */}
      <div className="px-3 pt-2 pb-3">
        <div className="text-xs font-semibold text-gray-500 mb-2">סמסטרים</div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {semesterOrder.map((sem) => {
            const courseIds = semesters[sem] ?? [];
            if (courseIds.length === 0) return null;
            const isSummer = plan.summerSemesters?.includes(sem);
            return (
              <div key={sem}>
                <div className="text-xs text-gray-400 mb-0.5">
                  {isSummer ? `קיץ (${sem})` : `סמ' ${SEM_LABELS[sem - 1] ?? sem}`}
                </div>
                <div className="flex flex-wrap gap-1">
                  {courseIds.map((id, i) => (
                    <span
                      key={`${id}_${i}`}
                      className="text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 truncate max-w-32"
                      title={courses.get(id)?.name ?? id}
                    >
                      {courses.get(id)?.name ?? id}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function VersionCompareModal({ versions, courses, trackDefs, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(versions.slice(0, Math.min(versions.length, 2)).map((v) => v.id)),
  );

  function toggleVersion(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        if (next.size >= 4) return prev;
        next.add(id);
      }
      return next;
    });
  }

  const selectedVersions = versions.filter((v) => selected.has(v.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col mx-4">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">השוואת גרסאות</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        {/* Version selector */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">בחר גרסאות:</span>
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => toggleVersion(v.id)}
              className={[
                'px-3 py-1 rounded-lg text-sm border transition-colors',
                selected.has(v.id)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300',
              ].join(' ')}
            >
              {v.name}
            </button>
          ))}
        </div>

        {/* Comparison columns */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex gap-3 items-start">
            {selectedVersions.map((v) => (
              <VersionColumn key={v.id} version={v} courses={courses} trackDefs={trackDefs} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
