import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { fetchCourses } from './services/sapApi';
import { isRetryableSyncError, savePlanToCloud, subscribeToCloudPlan } from './services/cloudSync';
import { usePlanStore } from './store/planStore';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TrackSelector } from './components/TrackSelector';
import { SemesterGrid } from './components/SemesterGrid';
import { RequirementsPanel } from './components/RequirementsPanel';
import { SpecializationPanel } from './components/SpecializationPanel';
import { CourseSearch } from './components/CourseSearch';
import { ChainRecommendations } from './components/ChainRecommendations';
import { LoginButton } from './components/LoginButton';
import { Toast } from './components/Toast';
import { eeTrack } from './data/tracks/ee';
import { csTrack } from './data/tracks/cs';
import { eeMathTrack } from './data/tracks/ee_math';
import { eePhysicsTrack } from './data/tracks/ee_physics';
import { eeCombinedTrack } from './data/tracks/ee_combined';
import { ceTrack } from './data/tracks/ce';
import type { SapCourse, TrackDefinition, StudentPlan } from './types';
import { useRequirementsProgress, useWeightedAverage } from './hooks/usePlan';
import {
  getTrackSpecializationCatalog,
  reportTrackSpecializationDiagnostics,
} from './domain/specializations';

// UI timing constants
const TOAST_DURATION_MS = 2500;
const SAVE_DEBOUNCE_MS = 2000;
const TRACK_SWITCH_DEBOUNCE_MS = 800;
const SYNC_RETRY_DELAY_MS = 5000;

const ALL_TRACKS: TrackDefinition[] = [eeTrack, csTrack, eeMathTrack, eePhysicsTrack, eeCombinedTrack, ceTrack];

function extractPlan(state: ReturnType<typeof usePlanStore.getState>): StudentPlan {
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
    savedTracks: state.savedTracks,
    dismissedRecommendedCourses: state.dismissedRecommendedCourses,
    miluimCredits: state.miluimCredits,
    englishScore: state.englishScore,
    englishTaughtCourses: state.englishTaughtCourses,
    facultyColorOverrides: state.facultyColorOverrides ?? {},
    coreToChainOverrides: state.coreToChainOverrides,
  };
}

function getPlanSignature(plan: StudentPlan): string {
  return JSON.stringify(plan);
}

function PlannerApp({ courses, trackDef }: { courses: Map<string, SapCourse>; trackDef: TrackDefinition }) {
  const {
    trackId,
    resetPlan,
    beginTrackSwitch,
    finishTrackSwitch,
    resetToDefault,
    undo,
    semesters,
    addCourseToSemester,
    removeCourseFromSemester,
    loadPlan,
    _history,
    _initKey,
    isSwitchingTrack,
    dismissedRecommendedCourses,
  } = usePlanStore(useShallow((state) => ({
    trackId: state.trackId,
    resetPlan: state.resetPlan,
    beginTrackSwitch: state.beginTrackSwitch,
    finishTrackSwitch: state.finishTrackSwitch,
    resetToDefault: state.resetToDefault,
    undo: state.undo,
    semesters: state.semesters,
    addCourseToSemester: state.addCourseToSemester,
    removeCourseFromSemester: state.removeCourseFromSemester,
    loadPlan: state.loadPlan,
    _history: state._history,
    _initKey: state._initKey,
    isSwitchingTrack: state.isSwitchingTrack,
    dismissedRecommendedCourses: state.dismissedRecommendedCourses,
  })));
  const specializationCatalog = getTrackSpecializationCatalog(trackDef.id);
  const specs = specializationCatalog.groups;
  const weightedAverage = useWeightedAverage(courses);
  const progress = useRequirementsProgress(courses, trackDef, specializationCatalog, weightedAverage);

  const initialized = useRef<Set<string>>(new Set());
  const { user } = useAuth();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadedUid = useRef<string | null>(null);
  const applyingCloudPlan = useRef(false);
  const latestLocalSignature = useRef(getPlanSignature(extractPlan(usePlanStore.getState())));
  const lastSaveTime = useRef(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCourseAdded = useCallback((courseName: string, semesterLabel: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: `${courseName} נוסף ל${semesterLabel}`, visible: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    reportTrackSpecializationDiagnostics(trackDef.id);
  }, [trackDef.id]);

  useEffect(() => {
    if (trackId === 'ce' && (semesters[4] ?? []).includes('01140073')) {
      removeCourseFromSemester('01140073', 4);
    }
  }, [trackId, semesters, removeCourseFromSemester]);

  useEffect(() => {
    if (!trackId) return;
    const key = `${trackId}_${_initKey}`;
    if (initialized.current.has(key)) return;
    initialized.current.add(key);

    const allPlaced = new Set(Object.values(semesters).flat());
    const alreadyInitialized = new Set<string>();
    const dismissedForTrack = new Set(dismissedRecommendedCourses?.[trackId] ?? []);
    for (const { semester, courses: ids } of trackDef.semesterSchedule) {
      for (const id of ids) {
        if (!allPlaced.has(id) && !alreadyInitialized.has(id) && courses.has(id) && !dismissedForTrack.has(id)) {
          addCourseToSemester(id, semester);
          alreadyInitialized.add(id);
        }
      }
    }
  }, [trackId, _initKey, semesters, trackDef.semesterSchedule, courses, addCourseToSemester, dismissedRecommendedCourses]);

  useEffect(() => {
    const clearSyncTimers = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };

    if (isSwitchingTrack && !trackId) {
      lastLoadedUid.current = null;
      clearSyncTimers();
      return;
    }

    if (!user) {
      if (lastLoadedUid.current !== null) {
        applyingCloudPlan.current = true;
        resetPlan();
        latestLocalSignature.current = getPlanSignature(extractPlan(usePlanStore.getState()));
        applyingCloudPlan.current = false;
      }
      lastLoadedUid.current = null;
      clearSyncTimers();
      return;
    }

    if (lastLoadedUid.current && lastLoadedUid.current !== user.uid) {
      applyingCloudPlan.current = true;
      resetPlan();
      latestLocalSignature.current = getPlanSignature(extractPlan(usePlanStore.getState()));
      applyingCloudPlan.current = false;
    }

    if (lastLoadedUid.current === user.uid) return;
    lastLoadedUid.current = user.uid;
    const uid = user.uid;

    const scheduleRetrySave = (delay = SYNC_RETRY_DELAY_MS, onSuccess?: () => void) => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        void doSave(onSuccess);
      }, delay);
    };

    const handleSaveError = (error: unknown, onSuccess?: () => void) => {
      const message = error instanceof Error ? error.message : 'שגיאת שמירה';
      if (isRetryableSyncError(error)) {
        setSyncStatus('error');
        setSyncErrorMessage(`${message}. ננסה שוב אוטומטית.`);
        scheduleRetrySave(SYNC_RETRY_DELAY_MS, onSuccess);
        return;
      }

      setSyncStatus('error');
      setSyncErrorMessage(message);
    };

    const doSave = async (onSuccess?: () => void) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }

      setSyncStatus('saving');
      setSyncErrorMessage(null);
      lastSaveTime.current = Date.now();
      const localPlan = extractPlan(usePlanStore.getState());
      latestLocalSignature.current = getPlanSignature(localPlan);

      try {
        await savePlanToCloud(uid, localPlan);
        setSyncStatus('saved');
        setSyncErrorMessage(null);
        onSuccess?.();
      } catch (error: unknown) {
        handleSaveError(error, onSuccess);
      }
    };

    if (isSwitchingTrack) {
      const unsubStore = usePlanStore.subscribe(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          void doSave(finishTrackSwitch);
        }, TRACK_SWITCH_DEBOUNCE_MS);
      });

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void doSave(finishTrackSwitch);
      }, TRACK_SWITCH_DEBOUNCE_MS);

      return () => {
        unsubStore();
        clearSyncTimers();
      };
    }

    const unsubSnapshot = subscribeToCloudPlan(
      uid,
      (cloudPlan) => {
        if (Date.now() - lastSaveTime.current < SYNC_RETRY_DELAY_MS) return;
        const cloudSignature = getPlanSignature(cloudPlan);
        if (cloudSignature === latestLocalSignature.current) return;
        applyingCloudPlan.current = true;
        loadPlan(cloudPlan);
        latestLocalSignature.current = cloudSignature;
        applyingCloudPlan.current = false;
        setSyncStatus('saved');
        setSyncErrorMessage(null);
      },
      () => {
        void doSave();
      },
      (error) => {
        if (isRetryableSyncError(error)) return;
        setSyncStatus('error');
        setSyncErrorMessage(error.message);
      },
    );

    const unsubStore = usePlanStore.subscribe(() => {
      if (applyingCloudPlan.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void doSave();
      }, SAVE_DEBOUNCE_MS);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && saveTimer.current) {
        void doSave();
      }
    };

    const handleOnline = () => {
      void doSave();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      unsubSnapshot();
      unsubStore();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      clearSyncTimers();
    };
  }, [user, trackId, loadPlan, resetPlan, finishTrackSwitch, isSwitchingTrack]);

  function handleResetToDefault() {
    if (window.confirm('האם לאפס את המערכת למומלצת? כל השינויים שלך יימחקו.')) {
      resetToDefault();
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toast message={toast.message} visible={toast.visible} />
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">מתכנן לימודים – הטכניון</h1>
            <p className="text-sm text-gray-500">{trackDef.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <LoginButton syncStatus={syncStatus} syncErrorMessage={syncErrorMessage} />
            <button
              onClick={undo}
              disabled={_history.length === 0}
              className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={_history.length > 0 ? `בטל פעולה אחרונה (${_history.length})` : 'אין פעולות לביטול'}
            >
              ↩ בטל
            </button>
            <button
              onClick={handleResetToDefault}
              className="text-sm text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-colors"
              title="החזר את המערכת לתכנית הלימודים המומלצת"
            >
              ⟳ מומלצת
            </button>
            <button
              onClick={beginTrackSwitch}
              className="text-sm text-red-500 hover:text-red-700 border border-red-300 hover:border-red-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              החלף מסלול
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto px-4 py-5">
        <div className="flex gap-4">
          <div className="w-64 shrink-0 flex flex-col gap-4 sticky top-20 self-start max-h-[calc(100vh-5rem)] overflow-y-auto">
            <RequirementsPanel progress={progress} weightedAverage={weightedAverage} />
            <SpecializationPanel catalog={specializationCatalog} courses={courses} />
            <ChainRecommendations catalog={specializationCatalog} courses={courses} />
          </div>
          <div className="flex-1 min-w-0">
            <CourseSearch courses={courses} onCourseAdded={handleCourseAdded} />
            <SemesterGrid courses={courses} trackDef={trackDef} specializations={specs} />
          </div>
        </div>
      </main>
    </div>
  );
}

function AppInner() {
  const [courses, setCourses] = useState<Map<string, SapCourse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const trackId = usePlanStore((s) => s.trackId);
  const isSwitchingTrack = usePlanStore((s) => s.isSwitchingTrack);
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch((e) => {
        console.error(e);
        setError('שגיאה בטעינת נתוני הקורסים. אנא בדוק את חיבור האינטרנט.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user || trackId || isSwitchingTrack) return;

    return subscribeToCloudPlan(
      user.uid,
      (cloudPlan) => loadPlan(cloudPlan),
      () => undefined,
    );
  }, [user, trackId, isSwitchingTrack, loadPlan]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">טוען נתוני קורסים...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow border border-red-200 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-2">⚠️ שגיאה בטעינה</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!trackId) return <TrackSelector tracks={ALL_TRACKS} />;

  const trackDef = ALL_TRACKS.find((t) => t.id === trackId);
  if (!trackDef) return null;

  return <PlannerApp courses={courses} trackDef={trackDef} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
