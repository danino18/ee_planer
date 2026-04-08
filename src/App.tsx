import { useEffect, useRef, useState } from 'react';
import { fetchCourses } from './services/sapApi';
import { savePlanToCloud, subscribeToCloudPlan } from './services/cloudSync';
import { usePlanStore } from './store/planStore';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TrackSelector } from './components/TrackSelector';
import { SemesterGrid } from './components/SemesterGrid';
import { RequirementsPanel } from './components/RequirementsPanel';
import { SpecializationPanel } from './components/SpecializationPanel';
import { CourseSearch } from './components/CourseSearch';
import { ChainRecommendations } from './components/ChainRecommendations';
import { LoginButton } from './components/LoginButton';
import { eeTrack } from './data/tracks/ee';
import { csTrack } from './data/tracks/cs';
import { eeMathTrack } from './data/tracks/ee_math';
import { eePhysicsTrack } from './data/tracks/ee_physics';
import { eeCombinedTrack } from './data/tracks/ee_combined';
import { ceTrack } from './data/tracks/ce';
import { eeSpecializations } from './data/specializations/ee_specializations';
import { csSpecializations } from './data/specializations/cs_specializations';
import type { SapCourse, TrackDefinition, SpecializationGroup, StudentPlan } from './types';
import { useRequirementsProgress, useWeightedAverage } from './hooks/usePlan';

const ALL_TRACKS: TrackDefinition[] = [eeTrack, csTrack, eeMathTrack, eePhysicsTrack, eeCombinedTrack, ceTrack];

/** Extract all persistable fields from the store for cloud save */
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
    savedTracks: state.savedTracks,
    miluimCredits: state.miluimCredits,
    englishScore: state.englishScore,
    englishTaughtCourses: state.englishTaughtCourses,
    facultyColorOverrides: state.facultyColorOverrides ?? {},
  };
}

function getPlanSignature(plan: StudentPlan): string {
  return JSON.stringify(plan);
}
const SPECS: Record<string, SpecializationGroup[]> = {
  ee: eeSpecializations, cs: csSpecializations,
  ee_math: eeSpecializations, ee_physics: eeSpecializations,
  ee_combined: eeSpecializations, ce: eeSpecializations,
};

function PlannerApp({ courses, trackDef }: { courses: Map<string, SapCourse>; trackDef: TrackDefinition }) {
  const store = usePlanStore();
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
  } = store;
  const _history = usePlanStore((s) => s._history);
  const _initKey = usePlanStore((s) => s._initKey);
  const isSwitchingTrack = usePlanStore((s) => s.isSwitchingTrack);
  const specs = SPECS[trackId ?? 'ee'] ?? [];
  const progress = useRequirementsProgress(courses, trackDef, specs);
  const weightedAverage = useWeightedAverage(courses);

  // Track which (trackId, initKey) combos have been initialized
  const initialized = useRef<Set<string>>(new Set());
  const { user } = useAuth();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadedUid = useRef<string | null>(null);
  const applyingCloudPlan = useRef(false);
  const latestLocalSignature = useRef(getPlanSignature(extractPlan(usePlanStore.getState())));
  // Timestamp of our most recent cloud save ג€” used to suppress the Firestore
  // snapshot that bounces back from our own write (avoid feedback loop).
  const lastSaveTime = useRef(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (trackId === 'ce' && (semesters[4] ?? []).includes('01140073')) {
      removeCourseFromSemester('01140073', 4);
    }
  }, [trackId, semesters, removeCourseFromSemester]);

  // Initialize plan with track's semester schedule + sport course pool
  // Re-runs when trackId changes OR when resetToDefault increments _initKey
  useEffect(() => {
    if (!trackId) return;
    const key = `${trackId}_${_initKey}`;
    if (initialized.current.has(key)) return;
    initialized.current.add(key);

    const allPlaced = new Set(Object.values(semesters).flat());
    const alreadyInitialized = new Set<string>();
    for (const { semester, courses: ids } of trackDef.semesterSchedule) {
      for (const id of ids) {
        if (!allPlaced.has(id) && !alreadyInitialized.has(id) && courses.has(id)) {
          addCourseToSemester(id, semester);
          alreadyInitialized.add(id);
        }
      }
    }
    // Pre-populate 1 copy of each repeatable sport course in unassigned pool
    const SPORT_POOL_IDS = ['03940900', '03940902'];
    for (const id of SPORT_POOL_IDS) {
      if (courses.has(id) && !(semesters[0] ?? []).includes(id)) {
        addCourseToSemester(id, 0);
      }
    }
  }, [trackId, _initKey, semesters, trackDef.semesterSchedule, courses, addCourseToSemester]);

  // Cloud sync: real-time listener + auto-save.
  //
  // On login:
  //   ג€¢ subscribeToCloudPlan fires immediately with the current cloud data ג†’ loads it.
  //   ג€¢ If no cloud document exists yet (first ever login) ג†’ saves the local plan.
  //
  // While logged in:
  //   ג€¢ onSnapshot fires whenever *another device* saves a new version ג†’ auto-applied.
  //   ג€¢ Local changes are debounced 2 s and saved via Cloud Function.
  //   ג€¢ After our own save we suppress the echo snapshot for 5 s (feedback-loop guard).
  //   ג€¢ On tab-hide / logout / unmount any pending save is flushed immediately.
  useEffect(() => {
    if (isSwitchingTrack && !trackId) {
      lastLoadedUid.current = null;
      return;
    }
    if (!user) {
      if (lastLoadedUid.current !== null) {
        applyingCloudPlan.current = true;
        resetPlan();
        latestLocalSignature.current = getPlanSignature(extractPlan(usePlanStore.getState()));
        applyingCloudPlan.current = false;
      }
      lastLoadedUid.current = null; // reset so next login re-subscribes
      return;
    }
    if (lastLoadedUid.current && lastLoadedUid.current !== user.uid) {
      applyingCloudPlan.current = true;
      resetPlan();
      latestLocalSignature.current = getPlanSignature(extractPlan(usePlanStore.getState()));
      applyingCloudPlan.current = false;
    }
    if (lastLoadedUid.current === user.uid) return; // already subscribed for this session
    lastLoadedUid.current = user.uid;
    const uid = user.uid;

    const doSave = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      setSyncStatus('saving');
      lastSaveTime.current = Date.now();
      const localPlan = extractPlan(usePlanStore.getState());
      latestLocalSignature.current = getPlanSignature(localPlan);
      savePlanToCloud(uid, localPlan)
        .then(() => setSyncStatus('saved'))
        .catch(() => setSyncStatus('error'));
    };

    if (isSwitchingTrack) {
      const doSaveSwitchedPlan = () => {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        setSyncStatus('saving');
        lastSaveTime.current = Date.now();
        const localPlan = extractPlan(usePlanStore.getState());
        latestLocalSignature.current = getPlanSignature(localPlan);
        savePlanToCloud(uid, localPlan)
          .then(() => {
            setSyncStatus('saved');
            finishTrackSwitch();
          })
          .catch(() => setSyncStatus('error'));
      };

      const unsubStore = usePlanStore.subscribe(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(doSaveSwitchedPlan, 800);
      });

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(doSaveSwitchedPlan, 800);

      return () => {
        unsubStore();
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
      };
    }

    // Real-time Firestore listener
    const unsubSnapshot = subscribeToCloudPlan(
      uid,
      (cloudPlan) => {
        // Ignore snapshots that are the echo of our own recent save
        if (Date.now() - lastSaveTime.current < 5000) return;
        const cloudSignature = getPlanSignature(cloudPlan);
        if (cloudSignature === latestLocalSignature.current) return;
        applyingCloudPlan.current = true;
        loadPlan(cloudPlan);
        latestLocalSignature.current = cloudSignature;
        applyingCloudPlan.current = false;
        setSyncStatus('saved');
      },
      () => {
        // No cloud plan yet ג†’ upload current local state
        doSave();
      },
    );

    // Auto-save on local state changes (debounced 2 s)
    const unsubStore = usePlanStore.subscribe(() => {
      if (applyingCloudPlan.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(doSave, 2000);
    });

    // Flush immediately when tab becomes hidden (user switches away / closes tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && saveTimer.current) doSave();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubSnapshot();
      unsubStore();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (saveTimer.current && !usePlanStore.getState().isSwitchingTrack) doSave(); // flush on logout / unmount
    };
  }, [user, trackId, loadPlan, resetPlan, finishTrackSwitch, isSwitchingTrack]);

  function handleResetToDefault() {
    if (window.confirm('׳”׳׳ ׳׳׳₪׳¡ ׳׳× ׳”׳׳¢׳¨׳›׳× ׳׳׳•׳׳׳¦׳×? ׳›׳ ׳”׳©׳™׳ ׳•׳™׳™׳ ׳©׳׳ ׳™׳™׳׳—׳§׳•.')) {
      resetToDefault();
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">׳׳×׳›׳ ׳ ׳׳™׳׳•׳“׳™׳ ג€“ ׳”׳˜׳›׳ ׳™׳•׳</h1>
            <p className="text-sm text-gray-500">{trackDef.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <LoginButton syncStatus={syncStatus} />
            {/* Undo last action */}
            <button
              onClick={undo}
              disabled={_history.length === 0}
              className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={_history.length > 0 ? `׳‘׳˜׳ ׳₪׳¢׳•׳׳” ׳׳—׳¨׳•׳ ׳” (${_history.length})` : '׳׳™׳ ׳₪׳¢׳•׳׳•׳× ׳׳‘׳™׳˜׳•׳'}
            >
              ג†© ׳‘׳˜׳
            </button>
            {/* Reset to recommended schedule */}
            <button
              onClick={handleResetToDefault}
              className="text-sm text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-colors"
              title="׳”׳—׳–׳¨ ׳׳× ׳”׳׳¢׳¨׳›׳× ׳׳×׳›׳ ׳™׳× ׳”׳׳™׳׳•׳“׳™׳ ׳”׳׳•׳׳׳¦׳×"
            >
              ג³ ׳׳•׳׳׳¦׳×
            </button>
            {/* Switch track */}
            <button
              onClick={beginTrackSwitch}
              className="text-sm text-red-500 hover:text-red-700 border border-red-300 hover:border-red-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              ׳”׳—׳׳£ ׳׳¡׳׳•׳
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto px-4 py-5">
        <div className="flex gap-4">
          <div className="w-64 shrink-0 flex flex-col gap-4 sticky top-20 self-start max-h-[calc(100vh-5rem)] overflow-y-auto">
            <RequirementsPanel progress={progress} weightedAverage={weightedAverage} />
            <SpecializationPanel groups={specs} courses={courses} />
            <ChainRecommendations groups={specs} courses={courses} />
          </div>
          <div className="flex-1 min-w-0">
            <CourseSearch courses={courses} />
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
        setError('׳©׳’׳™׳׳” ׳‘׳˜׳¢׳™׳ ׳× ׳ ׳×׳•׳ ׳™ ׳”׳§׳•׳¨׳¡׳™׳. ׳׳ ׳ ׳‘׳“׳•׳§ ׳׳× ׳—׳™׳‘׳•׳¨ ׳”׳׳™׳ ׳˜׳¨׳ ׳˜.');
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

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-600">׳˜׳•׳¢׳ ׳ ׳×׳•׳ ׳™ ׳§׳•׳¨׳¡׳™׳...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow border border-red-200 max-w-md text-center">
        <p className="text-red-600 font-semibold mb-2">ג ן¸ ׳©׳’׳™׳׳” ׳‘׳˜׳¢׳™׳ ׳”</p>
        <p className="text-gray-600 text-sm">{error}</p>
      </div>
    </div>
  );

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
