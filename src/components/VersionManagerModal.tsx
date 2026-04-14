import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../store/planStore';
import type { SapCourse, StudentPlan, StudentPlanVersion, TrackDefinition } from '../types';

interface Props {
  courses: Map<string, SapCourse>;
  tracks: TrackDefinition[];
  onClose: () => void;
}

function buildCurrentSnapshot(state: ReturnType<typeof usePlanStore.getState>): StudentPlan {
  return {
    trackId: state.trackId,
    semesters: state.semesters,
    completedCourses: state.completedCourses,
    selectedSpecializations: state.selectedSpecializations,
    favorites: state.favorites,
    grades: state.grades,
    substitutions: state.substitutions,
    maxSemester: state.maxSemester,
    selectedPrereqGroups: state.selectedPrereqGroups,
    summerSemesters: state.summerSemesters,
    currentSemester: state.currentSemester,
    semesterOrder: state.semesterOrder,
    semesterTypeOverrides: state.semesterTypeOverrides,
    semesterWarningsIgnored: state.semesterWarningsIgnored,
    doubleSpecializations: state.doubleSpecializations,
    hasEnglishExemption: state.hasEnglishExemption,
    manualSapAverages: state.manualSapAverages,
    binaryPass: state.binaryPass,
    completedInstances: state.completedInstances,
    miluimCredits: state.miluimCredits,
    englishScore: state.englishScore,
    englishTaughtCourses: state.englishTaughtCourses,
    dismissedRecommendedCourses: state.dismissedRecommendedCourses,
    facultyColorOverrides: state.facultyColorOverrides,
    coreToChainOverrides: state.coreToChainOverrides,
    roboticsMinorEnabled: state.roboticsMinorEnabled,
    entrepreneurshipMinorEnabled: state.entrepreneurshipMinorEnabled,
  };
}

function isStudentPlanVersion(value: unknown): value is StudentPlanVersion {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StudentPlanVersion>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.trackId === null || typeof candidate.trackId === 'string') &&
    !!candidate.plan &&
    typeof candidate.plan === 'object'
  );
}

function computeSummary(plan: StudentPlan, courses: Map<string, SapCourse>) {
  const courseIds = new Set([...(plan.completedCourses ?? []), ...Object.values(plan.semesters ?? {}).flat()]);
  const totalCredits = [...courseIds].reduce((sum, id) => sum + (courses.get(id)?.credits ?? 0), 0);

  let weightedSum = 0;
  let gradedCredits = 0;
  for (const [key, grade] of Object.entries(plan.grades)) {
    const courseId = key.includes('_') ? key.split('_')[0] : key;
    const credits = courses.get(courseId)?.credits ?? 0;
    if (credits > 0) {
      weightedSum += credits * grade;
      gradedCredits += credits;
    }
  }

  return {
    totalCredits,
    average: gradedCredits > 0 ? weightedSum / gradedCredits : null,
    courseCount: courseIds.size,
  };
}

function getSemesterLabel(semester: number, summerSemesters: number[]) {
  if (semester === 0) return 'ללא שיבוץ';
  return summerSemesters.includes(semester) ? `סמסטר קיץ ${semester}` : `סמסטר ${semester}`;
}

export function VersionManagerModal({ courses, tracks, onClose }: Props) {
  const {
    versions,
    activeVersionId,
    savedTracks,
    createVersion,
    renameVersion,
    switchVersion,
    deleteVersion,
    stateSnapshot,
  } = usePlanStore(useShallow((state) => ({
    versions: state.versions,
    activeVersionId: state.activeVersionId,
    savedTracks: state.savedTracks,
    createVersion: state.createVersion,
    renameVersion: state.renameVersion,
    switchVersion: state.switchVersion,
    deleteVersion: state.deleteVersion,
    stateSnapshot: buildCurrentSnapshot(state),
  })));

  const [compareIds, setCompareIds] = useState<string[]>(activeVersionId ? [activeVersionId] : []);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  const trackNames = useMemo(
    () => Object.fromEntries(tracks.map((track) => [track.id, track.name])) as Record<string, string>,
    [tracks],
  );

  const syncedVersions = useMemo(() => {
    const safeVersions = Array.isArray(versions) ? versions.filter(isStudentPlanVersion) : [];
    const safeSavedTracks =
      savedTracks && typeof savedTracks === 'object' && !Array.isArray(savedTracks) ? savedTracks : {};

    if (!activeVersionId) {
      return safeVersions;
    }

    return safeVersions.map((version) =>
      version.id === activeVersionId
        ? {
            ...version,
            trackId: stateSnapshot.trackId,
            plan: stateSnapshot,
            trackPlans: { ...(version.trackPlans ?? {}), ...safeSavedTracks },
          }
        : version,
    );
  }, [activeVersionId, savedTracks, stateSnapshot, versions]);

  const comparedVersions = useMemo(
    () => syncedVersions.filter((version) => compareIds.includes(version.id)),
    [compareIds, syncedVersions],
  );

  function toggleCompare(versionId: string) {
    setCompareIds((current) => {
      if (current.includes(versionId)) {
        return current.filter((id) => id !== versionId);
      }
      if (current.length >= 4) {
        return current;
      }
      return [...current, versionId];
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">ניהול גרסאות</h2>
            <p className="text-sm text-gray-500">עד 4 גרסאות, מעבר מהיר ביניהן והשוואה זו לצד זו.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createVersion()}
              disabled={syncedVersions.length >= 4}
              className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-blue-700 transition-colors hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              גרסה חדשה
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-400"
            >
              סגור
            </button>
          </div>
        </div>

        {syncedVersions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            עדיין אין גרסאות שמורות.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {syncedVersions.map((version) => {
              const summary = computeSummary(version.plan, courses);
              const draftName = renameDrafts[version.id] ?? version.name;
              const isActive = version.id === activeVersionId;
              const canDelete = syncedVersions.length > 1;

              return (
                <div
                  key={version.id}
                  className={`rounded-xl border p-4 ${
                    isActive ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <input
                        value={draftName}
                        onChange={(event) =>
                          setRenameDrafts((current) => ({ ...current, [version.id]: event.target.value }))
                        }
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm font-semibold text-gray-900"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {version.trackId ? trackNames[version.trackId] ?? version.trackId : 'ללא מסלול'}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(version.id)}
                        onChange={() => toggleCompare(version.id)}
                      />
                      השווה
                    </label>
                  </div>

                  <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-gray-50 px-2 py-2">
                      <div className="text-gray-400">נקודות</div>
                      <div className="font-semibold text-gray-800">{summary.totalCredits.toFixed(1)}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-2 py-2">
                      <div className="text-gray-400">ממוצע</div>
                      <div className="font-semibold text-gray-800">
                        {summary.average !== null ? summary.average.toFixed(1) : '—'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-2 py-2">
                      <div className="text-gray-400">קורסים</div>
                      <div className="font-semibold text-gray-800">{summary.courseCount}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        renameVersion(version.id, draftName);
                        setRenameDrafts((current) => ({
                          ...current,
                          [version.id]: draftName.trim() || version.name,
                        }));
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:border-gray-400"
                    >
                      שמור שם
                    </button>
                    <button
                      onClick={() => {
                        switchVersion(version.id);
                        onClose();
                      }}
                      className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs text-blue-700 transition-colors hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={isActive}
                    >
                      {isActive ? 'פעילה' : 'עבור לגרסה'}
                    </button>
                    <button
                      onClick={() => deleteVersion(version.id)}
                      disabled={!canDelete}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      מחק
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {comparedVersions.length >= 2 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-base font-bold text-gray-900">השוואה</h3>
            <div className={`grid gap-3 ${comparedVersions.length > 2 ? 'xl:grid-cols-3' : 'md:grid-cols-2'}`}>
              {comparedVersions.map((version) => {
                const summary = computeSummary(version.plan, courses);
                const semesterOrder = version.plan.semesterOrder?.length
                  ? version.plan.semesterOrder
                  : Array.from({ length: version.plan.maxSemester }, (_, index) => index + 1);

                return (
                  <div key={version.id} className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="mb-2">
                      <h4 className="font-semibold text-gray-900">{version.name}</h4>
                      <p className="text-xs text-gray-500">
                        {version.trackId ? trackNames[version.trackId] ?? version.trackId : 'ללא מסלול'}
                      </p>
                    </div>

                    <div className="mb-3 flex gap-2 text-xs text-gray-600">
                      <span>{summary.totalCredits.toFixed(1)} נק'</span>
                      <span>{summary.average !== null ? summary.average.toFixed(1) : '—'} ממוצע</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {[0, ...semesterOrder].map((semester) => {
                        const ids = version.plan.semesters[semester] ?? [];
                        if (ids.length === 0) {
                          return null;
                        }

                        return (
                          <div key={`${version.id}-${semester}`} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <div className="mb-1 font-medium text-gray-700">
                              {getSemesterLabel(semester, version.plan.summerSemesters)}
                            </div>
                            <div className="space-y-1 text-gray-600">
                              {ids.map((id, index) => (
                                <div key={`${version.id}-${semester}-${id}-${index}`}>{courses.get(id)?.name ?? id}</div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
