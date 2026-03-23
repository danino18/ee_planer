import { useEffect, useRef, useState } from 'react';
import { fetchCourses } from './services/sapApi';
import { savePlanToCloud, loadPlanFromCloud } from './services/cloudSync';
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
import { eeSpecializations } from './data/specializations/ee_specializations';
import { csSpecializations } from './data/specializations/cs_specializations';
import type { SapCourse, TrackDefinition, SpecializationGroup } from './types';
import { useRequirementsProgress, useWeightedAverage } from './hooks/usePlan';

const ALL_TRACKS: TrackDefinition[] = [eeTrack, csTrack, eeMathTrack, eePhysicsTrack];
const SPECS: Record<string, SpecializationGroup[]> = {
  ee: eeSpecializations, cs: csSpecializations,
  ee_math: eeSpecializations, ee_physics: eeSpecializations,
};

function PlannerApp({ courses, trackDef }: { courses: Map<string, SapCourse>; trackDef: TrackDefinition }) {
  const store = usePlanStore();
  const { trackId, resetPlan, semesters, addCourseToSemester, loadPlan } = store;
  const specs = SPECS[trackId ?? 'ee'] ?? [];
  const progress = useRequirementsProgress(courses, trackDef, specs);
  const weightedAverage = useWeightedAverage(courses);
  const initialized = useRef(false);
  const { user } = useAuth();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLoadCloud = useRef(false);

  // Initialize plan with track's semester schedule
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
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
  }, []);

  // Cloud sync: load plan from Firestore on login
  useEffect(() => {
    if (!user || didLoadCloud.current) return;
    didLoadCloud.current = true;
    loadPlanFromCloud(user.uid)
      .then((cloudPlan) => {
        if (cloudPlan) {
          loadPlan(cloudPlan);
        } else {
          // First login — save current local plan to cloud
          const { trackId, semesters, completedCourses, selectedSpecializations, favorites, grades, maxSemester, substitutions, selectedPrereqGroups } = store;
          savePlanToCloud(user.uid, { trackId, semesters, completedCourses, selectedSpecializations, favorites, grades, maxSemester, substitutions, selectedPrereqGroups });
        }
      })
      .catch(console.error);
  }, [user]);

  // Cloud sync: auto-save on plan changes (debounced 2s)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = usePlanStore.subscribe((state) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const { trackId, semesters, completedCourses, selectedSpecializations, favorites, grades, maxSemester, substitutions, selectedPrereqGroups } = state;
        savePlanToCloud(user.uid, { trackId, semesters, completedCourses, selectedSpecializations, favorites, grades, maxSemester, substitutions, selectedPrereqGroups }).catch(console.error);
      }, 2000);
    });
    return () => {
      unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">מתכנן לימודים – הטכניון</h1>
            <p className="text-sm text-gray-500">{trackDef.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <LoginButton />
            <button
              onClick={resetPlan}
              className="text-sm text-red-500 hover:text-red-700 border border-red-300 hover:border-red-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              החלף מסלול
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto px-4 py-5">
        <div className="flex gap-4">
          <div className="w-64 shrink-0 flex flex-col gap-4">
            <RequirementsPanel progress={progress} weightedAverage={weightedAverage} />
            <SpecializationPanel groups={specs} courses={courses} />
            <ChainRecommendations groups={specs} courses={courses} />
          </div>
          <div className="flex-1 min-w-0">
            <CourseSearch courses={courses} />
            <SemesterGrid courses={courses} trackDef={trackDef} />
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

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch((e) => {
        console.error(e);
        setError('שגיאה בטעינת נתוני הקורסים. אנא בדוק את חיבור האינטרנט.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-600">טוען נתוני קורסים...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow border border-red-200 max-w-md text-center">
        <p className="text-red-600 font-semibold mb-2">⚠️ שגיאה בטעינה</p>
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
