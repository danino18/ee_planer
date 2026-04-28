import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../store/planStore';
import type { DegreeCompletionData } from '../hooks/useDegreeCompletionCheck';
import type {
  DegreeRequirementCheck,
  ChainAssignmentSuggestion,
  CourseRecommendation,
} from '../domain/degreeCompletion';

interface Props {
  open: boolean;
  onClose: () => void;
  data: DegreeCompletionData | null;
}

const SEM_LABELS = [
  "א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'",
  "ח'", "ט'", "י'", 'י"א', 'י"ב', 'י"ג', 'י"ד', 'ט"ו', 'ט"ז',
];

const UNIT_LABELS: Record<string, string> = {
  credits: 'נק"ז',
  courses: 'קורסים',
  groups: 'קבוצות',
};

function CheckRow({ check }: { check: DegreeRequirementCheck }) {
  const pct = Math.min(100, check.required > 0 ? (check.earned / check.required) * 100 : 100);
  const unit = UNIT_LABELS[check.unit] ?? check.unit;
  const iconColor =
    check.status === 'completed' ? 'text-green-600' :
    check.status === 'partial' ? 'text-amber-500' : 'text-gray-400';
  const barColor =
    check.status === 'completed' ? 'bg-green-500' :
    check.status === 'partial' ? 'bg-amber-400' : 'bg-gray-200';
  const valueColor = check.status === 'completed' ? 'text-green-600' : 'text-gray-600';
  const earned = check.earned % 1 === 0 ? check.earned : check.earned.toFixed(1);

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
        <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  onConfirm,
}: {
  suggestion: ChainAssignmentSuggestion;
  onConfirm: () => void;
}) {
  const groupNames = suggestion.candidateGroupIds.length;
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{suggestion.courseName}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          משותף ל-{groupNames} שרשראות — מומלץ: <span className="font-semibold text-blue-700">{suggestion.suggestedGroupName}</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{suggestion.reason}</p>
      </div>
      <button
        onClick={onConfirm}
        className="shrink-0 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
      >
        אשר
      </button>
    </div>
  );
}

function RecommendationRow({
  rec,
  onAdd,
}: {
  rec: CourseRecommendation;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-800 truncate">{rec.courseName}</span>
          {rec.credits > 0 && (
            <span className="text-xs text-gray-400 shrink-0">{rec.credits} נק"ז</span>
          )}
          {rec.priority === 'mandatory' && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded shrink-0">חובה</span>
          )}
        </div>
        {rec.suggestedSemesterLabel && (
          <p className={`text-xs mt-0.5 ${rec.semesterLoadWarning ? 'text-amber-600' : 'text-gray-500'}`}>
            → {rec.suggestedSemesterLabel}
            {rec.semesterLoadWarning && ' ⚠ עומס גבוה'}
          </p>
        )}
      </div>
      {rec.suggestedSemesterId !== null && (
        <button
          onClick={onAdd}
          className="shrink-0 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          + הוסף
        </button>
      )}
    </div>
  );
}

export function DegreeCompletionModal({ open, onClose, data }: Props) {
  const {
    semesterOrder,
    summerSemesters,
    targetGraduationSemesterId,
    loadProfile,
    addCourseToSemester,
    setCourseChainAssignment,
    setTargetGraduationSemesterId,
    setLoadProfile,
  } = usePlanStore(useShallow((s) => ({
    semesterOrder: s.semesterOrder,
    summerSemesters: s.summerSemesters,
    targetGraduationSemesterId: s.targetGraduationSemesterId ?? null,
    loadProfile: s.loadProfile ?? 'fulltime' as const,
    addCourseToSemester: s.addCourseToSemester,
    setCourseChainAssignment: s.setCourseChainAssignment,
    setTargetGraduationSemesterId: s.setTargetGraduationSemesterId,
    setLoadProfile: s.setLoadProfile,
  })));

  const semesterLabels = useMemo(() => {
    const labels = new Map<number, string>();
    const summerSet = new Set(summerSemesters);
    let regularIdx = 0;
    let summerIdx = 0;
    for (const semId of semesterOrder) {
      if (summerSet.has(semId)) {
        labels.set(semId, `קיץ ${SEM_LABELS[summerIdx] ?? semId}`);
        summerIdx++;
      } else {
        labels.set(semId, `סמסטר ${SEM_LABELS[regularIdx] ?? semId}`);
        regularIdx++;
      }
    }
    return labels;
  }, [semesterOrder, summerSemesters]);

  const [localGradSem, setLocalGradSem] = useState<number | ''>(targetGraduationSemesterId ?? '');
  const [localLoadProfile, setLocalLoadProfile] = useState<'working' | 'fulltime'>(loadProfile);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const needsSetup = !targetGraduationSemesterId;

  function handleSaveSetup() {
    setTargetGraduationSemesterId(typeof localGradSem === 'number' ? localGradSem : null);
    setLoadProfile(localLoadProfile);
  }

  function handleConfirmSuggestion(suggestion: ChainAssignmentSuggestion) {
    setCourseChainAssignment(suggestion.courseId, suggestion.suggestedGroupId);
    setDismissedSuggestions((prev) => new Set([...prev, suggestion.courseId]));
  }

  function handleConfirmAllSuggestions() {
    for (const s of data?.chainSuggestions ?? []) {
      if (!dismissedSuggestions.has(s.courseId)) {
        setCourseChainAssignment(s.courseId, s.suggestedGroupId);
      }
    }
    setDismissedSuggestions(new Set((data?.chainSuggestions ?? []).map((s) => s.courseId)));
  }

  const visibleSuggestions = (data?.chainSuggestions ?? []).filter(
    (s) => !dismissedSuggestions.has(s.courseId),
  );

  // Group course recommendations by requirementTitle
  const recommendationGroups = useMemo(() => {
    const groups = new Map<string, CourseRecommendation[]>();
    for (const rec of data?.courseRecommendations ?? []) {
      if (!groups.has(rec.requirementTitle)) groups.set(rec.requirementTitle, []);
      groups.get(rec.requirementTitle)!.push(rec);
    }
    return groups;
  }, [data?.courseRecommendations]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto z-10">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">בדיקת גמר תואר</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Setup section */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-blue-900">הגדרות תכנון</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-700 block mb-1.5">באיזה סמסטר אתה מתכנן לסיים?</label>
                <select
                  value={localGradSem}
                  onChange={(e) => setLocalGradSem(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">לא הוגדר</option>
                  {semesterOrder.map((semId) => (
                    <option key={semId} value={semId}>
                      {semesterLabels.get(semId) ?? `סמסטר ${semId}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700 block mb-1.5">פרופיל עומס</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLocalLoadProfile('fulltime')}
                    className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-colors ${
                      localLoadProfile === 'fulltime'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    מתמקד בתואר
                  </button>
                  <button
                    onClick={() => setLocalLoadProfile('working')}
                    className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-colors ${
                      localLoadProfile === 'working'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    עובד תוך כדי
                  </button>
                </div>
              </div>
              {(localGradSem !== (targetGraduationSemesterId ?? '') || localLoadProfile !== loadProfile) && (
                <button
                  onClick={handleSaveSetup}
                  className="w-full text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  שמור הגדרות
                </button>
              )}
            </div>
          </div>

          {/* Requirements status */}
          {data && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">סטטוס דרישות</h3>
                {data.result.isComplete && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                    ✓ התואר הושלם!
                  </span>
                )}
              </div>
              {data.result.isComplete ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-green-700 font-bold text-sm">כל הדרישות עמדו</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-gray-100">
                    {data.result.requirements.map((check) => (
                      <CheckRow key={check.id} check={check} />
                    ))}
                  </div>
                  {data.result.missingRequirements.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">חסר להשלמת התואר:</p>
                      <ul className="space-y-0.5">
                        {data.result.missingRequirements.map((r) => (
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
                </>
              )}
            </div>
          )}

          {/* Chain assignment suggestions */}
          {visibleSuggestions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">הקצאת קורסים לשרשראות</h3>
                <button
                  onClick={handleConfirmAllSuggestions}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-2.5 py-1 rounded-lg transition-colors"
                >
                  אשר הכל
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                קורסים אלו שייכים למספר שרשראות — הקצה אותם לשרשרת שתרוויח ממנו ביותר.
              </p>
              <div>
                {visibleSuggestions.map((s) => (
                  <SuggestionRow
                    key={s.courseId}
                    suggestion={s}
                    onConfirm={() => handleConfirmSuggestion(s)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Course recommendations */}
          {data && !data.result.isComplete && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">קורסים מומלצים לסגירת התואר</h3>
              </div>
              {recommendationGroups.size > 0 ? (
                <>
                  {needsSetup && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                      הגדר סמסטר סיום בהגדרות למעלה לקבלת המלצות מדויקות יותר
                    </p>
                  )}
                  <div className="space-y-5">
                    {[...recommendationGroups.entries()].map(([title, recs]) => (
                      <div key={title}>
                        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{title}</p>
                        <div>
                          {recs.map((rec) => (
                            <RecommendationRow
                              key={rec.courseId}
                              rec={rec}
                              onAdd={() => {
                                if (rec.suggestedSemesterId !== null) {
                                  addCourseToSemester(rec.courseId, rec.suggestedSemesterId);
                                }
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {data.result.missingRequirements.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2">לסגירת התואר נדרשים עוד:</p>
                      <ul className="space-y-1">
                        {data.result.missingRequirements.map((req) => (
                          <li key={req.id} className="text-xs text-gray-700 flex items-center gap-1.5">
                            <span className="text-amber-500 shrink-0">○</span>
                            {req.title}: עוד {req.missingValue} {UNIT_LABELS[req.unit] ?? req.unit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-center text-gray-500">
                    בחר שרשראות התמחות בלוח הצד לקבלת המלצות על קורסים ספציפיים
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
