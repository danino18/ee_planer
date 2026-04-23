import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { fetchCourses } from './services/sapApi';
import { isRetryableSyncError, savePlanToCloud, subscribeToCloudPlan } from './services/cloudSync';
import { usePlanStore } from './store/planStore';
import { buildEnvelopeFromState, getPlanSignature, shouldApplyCloudEnvelope } from './services/planSync';
import { VersionTabs } from './components/VersionTabs';
import { VersionCompareModal } from './components/VersionCompareModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TrackSelector } from './components/TrackSelector';
import { SemesterGrid } from './components/SemesterGrid';
import { RequirementsPanel } from './components/RequirementsPanel';
import { SpecializationPanel } from './components/SpecializationPanel';
import { CourseSearch } from './components/CourseSearch';
import { ChainRecommendations } from './components/ChainRecommendations';
import { LoginButton } from './components/LoginButton';
import { Toast } from './components/Toast';
import { MobileSidebarDrawer } from './components/MobileSidebarDrawer';
import { eeTrack } from './data/tracks/ee';
import { csTrack } from './data/tracks/cs';
import { eeMathTrack } from './data/tracks/ee_math';
import { eePhysicsTrack } from './data/tracks/ee_physics';
import { eeCombinedTrack } from './data/tracks/ee_combined';
import { ceTrack } from './data/tracks/ce';
import type { SapCourse, TrackDefinition, VersionedPlanEnvelope } from './types';
import { useRequirementsProgress, useWeightedAverage } from './hooks/usePlan';
import { getRecommendedCourseIdsForEntry } from './data/tracks/semesterSchedule';
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

function extractEnvelope(
  state: ReturnType<typeof usePlanStore.getState>,
  activeVersionUpdatedAt?: number,
): VersionedPlanEnvelope {
  return buildEnvelopeFromState(state, { activeVersionUpdatedAt });
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
    loadEnvelope,
    _history,
    _initKey,
    isSwitchingTrack,
    dismissedRecommendedCourses,
    englishScore,
    initializedTracks,
    markTrackInitialized,
    versions,
    hasPendingCloudSync,
    markCloudSyncPending,
    markCloudSyncSettled,
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
    loadEnvelope: state.loadEnvelope,
    _history: state._history,
    _initKey: state._initKey,
    isSwitchingTrack: state.isSwitchingTrack,
    dismissedRecommendedCourses: state.dismissedRecommendedCourses,
    englishScore: state.englishScore,
    initializedTracks: state.initializedTracks,
    markTrackInitialized: state.markTrackInitialized,
    versions: state.versions,
    hasPendingCloudSync: state.hasPendingCloudSync,
    markCloudSyncPending: state.markCloudSyncPending,
    markCloudSyncSettled: state.markCloudSyncSettled,
  })));
  const specializationCatalog = getTrackSpecializationCatalog(trackDef.id);
  const specs = specializationCatalog.groups;
  const weightedAverage = useWeightedAverage(courses);
  const progress = useRequirementsProgress(courses, trackDef, specializationCatalog, weightedAverage);

  const initialized = useRef<Set<string>>(new Set());
  const { user } = useAuth();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const lastLoadedUid = useRef<string | null>(null);
  const applyingCloudPlan = useRef(false);
  const cloudSyncReady = useRef(false);
  const suppressAutoInitCloudPending = useRef(false);
  const latestLocalSignature = useRef(getPlanSignature(extractEnvelope(usePlanStore.getState())));
  const lastSaveTime = useRef(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
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
    if (!user) {
      setSyncStatus('idle');
      return;
    }

    setSyncStatus((currentStatus) => {
      if (currentStatus === 'saving' || currentStatus === 'error') return currentStatus;
      return hasPendingCloudSync ? 'pending' : 'saved';
    });
  }, [user, hasPendingCloudSync]);

  useEffect(() => {
    if (trackId === 'ce' && (semesters[4] ?? []).includes('01140073')) {
      removeCourseFromSemester('01140073', 4);
    }
  }, [trackId, semesters, removeCourseFromSemester]);

  useEffect(() => {
    if (!trackId) return;
    const key = `${trackId}_${_initKey}`;
    if (initialized.current.has(key)) return;

    // Cross-reload guard: if this track was already initialized in a previous session, skip
    if ((initializedTracks ?? []).includes(trackId)) {
      initialized.current.add(key); // prevent further in-session re-runs
      return;
    }

    initialized.current.add(key);

    suppressAutoInitCloudPending.current = true;
    try {
      const allPlaced = new Set(Object.values(semesters).flat());
      const alreadyInitialized = new Set<string>();
      const dismissedForTrack = new Set(dismissedRecommendedCourses?.[trackId] ?? []);
      for (const entry of trackDef.semesterSchedule) {
        const ids = getRecommendedCourseIdsForEntry(entry, courses, englishScore);
        for (const id of ids) {
          if (!allPlaced.has(id) && !alreadyInitialized.has(id) && courses.has(id) && !dismissedForTrack.has(id)) {
            addCourseToSemester(id, entry.semester);
            alreadyInitialized.add(id);
          }
        }
      }
      markTrackInitialized(trackId);
    } finally {
      suppressAutoInitCloudPending.current = false;
    }
  }, [trackId, _initKey, semesters, trackDef.semesterSchedule, courses, addCourseToSemester, dismissedRecommendedCourses, englishScore, initializedTracks, markTrackInitialized]);

  useEffect(() => {
    const unsubscribe = usePlanStore.subscribe((state, previousState) => {
      if (applyingCloudPlan.current) return;
      if (suppressAutoInitCloudPending.current) return;

      const currentSignature = getPlanSignature(extractEnvelope(state));
      const previousSignature = getPlanSignature(extractEnvelope(previousState));
      if (currentSignature === previousSignature) return;

      latestLocalSignature.current = currentSignature;
      markCloudSyncPending(Date.now());
      if (user) {
        setSyncStatus('pending');
        setSyncErrorMessage(null);
      }
    });

    return unsubscribe;
  }, [markCloudSyncPending, user]);

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
        latestLocalSignature.current = getPlanSignature(extractEnvelope(usePlanStore.getState()));
        applyingCloudPlan.current = false;
      }
      lastLoadedUid.current = null;
      clearSyncTimers();
      return;
    }

    if (lastLoadedUid.current && lastLoadedUid.current !== user.uid) {
      applyingCloudPlan.current = true;
      resetPlan();
      latestLocalSignature.current = getPlanSignature(extractEnvelope(usePlanStore.getState()));
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
      if (isSavingRef.current) return;
      // Never write to Firestore before we've received the first cloud snapshot.
      // Prevents overwriting cloud data with auto-initialized local state.
      if (!cloudSyncReady.current) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }

      const localState = usePlanStore.getState();
      const saveTimestamp = Math.max(localState.lastLocalEditAt ?? 0, Date.now());
      const localEnvelope = extractEnvelope(localState, saveTimestamp);

      isSavingRef.current = true;
      setSyncStatus('saving');
      setSyncErrorMessage(null);
      lastSaveTime.current = Date.now();
      latestLocalSignature.current = getPlanSignature(localEnvelope);

      try {
        await savePlanToCloud(uid, localEnvelope);
        setSyncErrorMessage(null);
        const currentState = usePlanStore.getState();
        if ((currentState.lastLocalEditAt ?? 0) <= saveTimestamp) {
          applyingCloudPlan.current = true;
          currentState.markCloudSyncSettled(saveTimestamp);
          latestLocalSignature.current = getPlanSignature(extractEnvelope(usePlanStore.getState()));
          applyingCloudPlan.current = false;
          setSyncStatus('saved');
          onSuccess?.();
        } else {
          setSyncStatus('pending');
          scheduleRetrySave(SAVE_DEBOUNCE_MS, onSuccess);
        }
      } catch (error: unknown) {
        handleSaveError(error, onSuccess);
      } finally {
        isSavingRef.current = false;
      }
    };

    const handleCloudEnvelope = (cloudEnvelope: VersionedPlanEnvelope) => {
      cloudSyncReady.current = true;
      const localState = usePlanStore.getState();
      const localEnvelope = extractEnvelope(localState);
      const localSignature = getPlanSignature(localEnvelope);
      const cloudSignature = getPlanSignature(cloudEnvelope);

      if (cloudSignature === localSignature) {
        latestLocalSignature.current = localSignature;
        if (localState.hasPendingCloudSync) {
          applyingCloudPlan.current = true;
          localState.markCloudSyncSettled();
          applyingCloudPlan.current = false;
        }
        setSyncStatus('saved');
        setSyncErrorMessage(null);
        return;
      }

      if (shouldApplyCloudEnvelope(localEnvelope, cloudEnvelope, localState.hasPendingCloudSync)) {
        applyingCloudPlan.current = true;
        loadEnvelope(cloudEnvelope);
        latestLocalSignature.current = cloudSignature;
        applyingCloudPlan.current = false;
        setSyncStatus('saved');
        setSyncErrorMessage(null);
        return;
      }

      latestLocalSignature.current = localSignature;
      if (localState.hasPendingCloudSync) {
        setSyncStatus('pending');
        setSyncErrorMessage(null);
        void doSave();
      }
    };

    const unsubSnapshot = subscribeToCloudPlan(
      uid,
      handleCloudEnvelope,
      () => {
        cloudSyncReady.current = true;
        void doSave();
      },
      (error) => {
        if (isRetryableSyncError(error)) return;
        setSyncStatus('error');
        setSyncErrorMessage(error.message);
      },
    );

    const unsubStore = usePlanStore.subscribe((state, previousState) => {
      if (applyingCloudPlan.current) return;
      const currentSignature = getPlanSignature(extractEnvelope(state));
      const previousSignature = getPlanSignature(extractEnvelope(previousState));
      if (currentSignature === previousSignature) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void doSave(isSwitchingTrack ? finishTrackSwitch : undefined);
      }, isSwitchingTrack ? TRACK_SWITCH_DEBOUNCE_MS : SAVE_DEBOUNCE_MS);
    });

    if (isSwitchingTrack) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void doSave(finishTrackSwitch);
      }, TRACK_SWITCH_DEBOUNCE_MS);
    }

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
      cloudSyncReady.current = false;
      unsubSnapshot();
      unsubStore();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      clearSyncTimers();
    };
  }, [user, trackId, loadEnvelope, resetPlan, finishTrackSwitch, isSwitchingTrack, markCloudSyncSettled]);

  const [showCompare, setShowCompare] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleResetToDefault() {
    if (window.confirm('האם לאפס את המערכת למומלצת? כל השינויים שלך יימחקו.')) {
      resetToDefault();
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toast message={toast.message} visible={toast.visible} />
      {showCompare && (
        <VersionCompareModal
          versions={versions ?? []}
          courses={courses}
          trackDefs={ALL_TRACKS}
          onClose={() => setShowCompare(false)}
        />
      )}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-5 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">מתכנן לימודים – הטכניון</h1>
              <p className="text-sm text-gray-500">{trackDef.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden text-sm text-gray-600 border border-gray-200 px-2 py-1.5 rounded-lg"
                aria-label="פתח תפריט"
                aria-expanded={sidebarOpen}
                aria-controls="sidebar-drawer"
              >☰</button>
              <LoginButton syncStatus={syncStatus} syncErrorMessage={syncErrorMessage} />
              <button
                onClick={undo}
                disabled={_history.length === 0}
                className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={_history.length > 0 ? `בטל פעולה אחרונה (${_history.length})` : 'אין פעולות לביטול'}
              >
                <span>↩</span><span className="hidden sm:inline"> בטל</span>
              </button>
              <button
                onClick={handleResetToDefault}
                className="text-sm text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-colors"
                title="החזר את המערכת לתכנית הלימודים המומלצת"
              >
                <span>⟳</span><span className="hidden sm:inline"> מומלצת</span>
              </button>
              <button
                onClick={beginTrackSwitch}
                className="text-sm text-red-500 hover:text-red-700 border border-red-300 hover:border-red-500 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span className="hidden sm:inline">החלף מסלול</span><span className="sm:hidden">מסלול</span>
              </button>
            </div>
          </div>
          <VersionTabs onCompare={() => setShowCompare(true)} />
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-4 md:py-5">
        <div className="flex flex-col md:flex-row md:gap-4">
          {/* Desktop sidebar — hidden on mobile */}
          <aside className="hidden md:flex md:w-64 shrink-0 flex-col gap-4 sticky top-20 self-start max-h-[calc(100vh-5rem)] overflow-y-auto">
            <RequirementsPanel progress={progress} weightedAverage={weightedAverage} />
            <SpecializationPanel catalog={specializationCatalog} courses={courses} />
            <ChainRecommendations catalog={specializationCatalog} courses={courses} />
          </aside>

          {/* Mobile drawer — md:hidden enforced inside component */}
          <MobileSidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
            <RequirementsPanel progress={progress} weightedAverage={weightedAverage} />
            <SpecializationPanel catalog={specializationCatalog} courses={courses} />
            <ChainRecommendations catalog={specializationCatalog} courses={courses} />
          </MobileSidebarDrawer>

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
  const hasPendingCloudSync = usePlanStore((s) => s.hasPendingCloudSync);
  const loadEnvelope = usePlanStore((s) => s.loadEnvelope);
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
      (cloudEnvelope) => {
        const localState = usePlanStore.getState();
        const localEnvelope = extractEnvelope(localState);
        if (getPlanSignature(localEnvelope) === getPlanSignature(cloudEnvelope)) {
          return;
        }

        if (shouldApplyCloudEnvelope(localEnvelope, cloudEnvelope, hasPendingCloudSync)) {
          loadEnvelope(cloudEnvelope);
        }
      },
      () => undefined,
    );
  }, [user, trackId, isSwitchingTrack, loadEnvelope, hasPendingCloudSync]);

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
