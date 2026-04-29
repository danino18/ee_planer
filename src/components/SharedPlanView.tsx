import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchShare, updateSharedEnvelope } from '../services/shareApi';
import { fetchCourses } from '../services/sapApi';
import { useAuth } from '../context/AuthContext';
import type { GetShareResponse, ShareDoc } from '../types/share';
import type { PlanVersion, SapCourse, TrackId, VersionedPlanEnvelope } from '../types';

const TRACK_NAMES: Record<TrackId, string> = {
  ee: 'חשמל',
  cs: 'מחשבים',
  ee_math: 'חשמל + מתמטיקה',
  ee_physics: 'חשמל + פיזיקה',
  ee_combined: 'חשמל משולב',
  ce: 'הנדסת מחשבים',
};

interface Props {
  shareId: string;
}

export function SharedPlanView({ shareId }: Props) {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [response, setResponse] = useState<GetShareResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Map<string, SapCourse>>(new Map());

  // Local working copy of the envelope for inline editing in edit-mode.
  const [workingEnvelope, setWorkingEnvelope] = useState<VersionedPlanEnvelope | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch((err) => console.error('[SharedPlanView] courses load failed', err));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchShare(shareId)
      .then((res) => {
        if (cancelled) return;
        setResponse(res);
        setLoadError(null);
        if (res.ok) setWorkingEnvelope(res.share.envelope);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[SharedPlanView] fetchShare failed', err);
        setLoadError('טעינת הקישור נכשלה. בדוק את החיבור ונסה שנית.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch when the auth state changes (e.g., user just signed in).
  }, [shareId, user]);

  function scheduleSave(envelope: VersionedPlanEnvelope) {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    setSaveStatus('saving');
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await updateSharedEnvelope(shareId, envelope);
        setSaveStatus('saved');
        window.setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('[SharedPlanView] save failed', err);
        setSaveStatus('error');
      }
    }, 800);
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (authLoading || loading) {
    return <CenteredMessage>טוען...</CenteredMessage>;
  }

  if (loadError) {
    return <CenteredMessage tone="error">{loadError}</CenteredMessage>;
  }

  if (!response) {
    return <CenteredMessage tone="error">שגיאה לא צפויה</CenteredMessage>;
  }

  if (!response.ok) {
    if (response.reason === 'not_found') {
      return <CenteredMessage tone="error">הקישור לא נמצא או נמחק.</CenteredMessage>;
    }
    if (response.reason === 'revoked') {
      return <CenteredMessage tone="error">הקישור בוטל על ידי בעל התוכנית.</CenteredMessage>;
    }
    if (response.reason === 'auth_required') {
      return (
        <CenteredCard title="נדרשת התחברות לצפייה בקישור">
          <p className="text-sm text-gray-700 mb-3">
            הקישור הזה משותף עם אנשים ספציפיים. התחבר עם החשבון שלך כדי לוודא שיש לך גישה.
          </p>
          <button
            onClick={() => signInWithGoogle()}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >התחבר עם Google</button>
        </CenteredCard>
      );
    }
    if (response.reason === 'forbidden') {
      return (
        <CenteredCard title="אין לך הרשאה לצפות בקישור הזה" tone="error">
          <p className="text-sm text-gray-700 mb-2">
            כתובת המייל המקושרת לחשבון שלך אינה ברשימת המורשים.
            {user?.email && (
              <>
                {' '}
                (מחובר כ-<span dir="ltr" className="font-mono">{user.email}</span>)
              </>
            )}
          </p>
          <button
            onClick={() => signOut()}
            className="text-sm border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
          >התחבר עם חשבון אחר</button>
        </CenteredCard>
      );
    }
  }

  if (!response.ok || !workingEnvelope) {
    return <CenteredMessage tone="error">שגיאה לא צפויה</CenteredMessage>;
  }

  const { share, canEdit } = response;
  return (
    <SharedPlanContent
      share={share}
      envelope={workingEnvelope}
      canEdit={canEdit}
      courses={courses}
      currentUserEmail={user?.email ?? null}
      saveStatus={saveStatus}
      onEnvelopeChange={(next) => {
        setWorkingEnvelope(next);
        if (canEdit) scheduleSave(next);
      }}
    />
  );
}

interface SharedPlanContentProps {
  share: ShareDoc;
  envelope: VersionedPlanEnvelope;
  canEdit: boolean;
  courses: Map<string, SapCourse>;
  currentUserEmail: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onEnvelopeChange: (next: VersionedPlanEnvelope) => void;
}

function SharedPlanContent({
  share,
  envelope,
  canEdit,
  courses,
  currentUserEmail,
  saveStatus,
  onEnvelopeChange,
}: SharedPlanContentProps) {
  const [activeId, setActiveId] = useState<string>(envelope.activeVersionId);

  const activeVersion = useMemo(
    () => envelope.versions.find((v) => v.id === activeId) ?? envelope.versions[0],
    [envelope, activeId],
  );

  function updateActiveVersionPlan(updater: (v: PlanVersion) => PlanVersion) {
    const next: VersionedPlanEnvelope = {
      ...envelope,
      versions: envelope.versions.map((v) => (v.id === activeVersion.id ? updater(v) : v)),
    };
    onEnvelopeChange(next);
  }

  function setGrade(courseId: string, grade: number | null) {
    updateActiveVersionPlan((v) => {
      const grades = { ...v.plan.grades };
      if (grade === null || Number.isNaN(grade)) {
        delete grades[courseId];
      } else {
        grades[courseId] = grade;
      }
      return { ...v, plan: { ...v.plan, grades }, updatedAt: Date.now() };
    });
  }

  function toggleCompleted(courseId: string) {
    updateActiveVersionPlan((v) => {
      const completed = new Set(v.plan.completedCourses);
      if (completed.has(courseId)) completed.delete(courseId);
      else completed.add(courseId);
      return {
        ...v,
        plan: { ...v.plan, completedCourses: [...completed] },
        updatedAt: Date.now(),
      };
    });
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-900">תוכנית לימודים משותפת</h1>
            <p className="text-xs text-gray-500">
              שותפה על ידי {share.ownerEmail ?? 'משתמש'} · {' '}
              {canEdit ? 'מצב עריכה' : 'צפייה בלבד'}
              {share.access === 'restricted' && ' · אנשים ספציפיים'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <SaveIndicator status={saveStatus} />
            )}
            {currentUserEmail && (
              <span className="text-xs text-gray-500" dir="ltr">{currentUserEmail}</span>
            )}
            <a
              href={window.location.origin}
              className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-2.5 py-1.5 rounded-lg transition-colors"
            >פתח את המתכנן שלי</a>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-5 py-6">
        {envelope.versions.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {envelope.versions.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveId(v.id)}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  v.id === activeVersion.id
                    ? 'border-blue-500 text-blue-700 bg-blue-50'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >{v.name}</button>
            ))}
          </div>
        )}

        <VersionPlanView
          version={activeVersion}
          courses={courses}
          canEdit={canEdit}
          onSetGrade={setGrade}
          onToggleCompleted={toggleCompleted}
        />
      </main>
    </div>
  );
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const label = status === 'saving'
    ? 'שומר...'
    : status === 'saved'
      ? '✓ נשמר'
      : 'שגיאה בשמירה';
  const cls = status === 'error'
    ? 'text-red-600'
    : status === 'saved'
      ? 'text-emerald-600'
      : 'text-gray-500';
  return <span className={`text-xs ${cls}`}>{label}</span>;
}

interface VersionPlanViewProps {
  version: PlanVersion;
  courses: Map<string, SapCourse>;
  canEdit: boolean;
  onSetGrade: (courseId: string, grade: number | null) => void;
  onToggleCompleted: (courseId: string) => void;
}

function VersionPlanView({
  version,
  courses,
  canEdit,
  onSetGrade,
  onToggleCompleted,
}: VersionPlanViewProps) {
  const { plan } = version;
  const completedSet = useMemo(() => new Set(plan.completedCourses), [plan.completedCourses]);
  const semesterIds = useMemo(() => {
    const fromOrder = plan.semesterOrder?.length
      ? plan.semesterOrder
      : Object.keys(plan.semesters).map((k) => Number(k));
    const all = new Set<number>(fromOrder);
    for (const id of Object.keys(plan.semesters)) all.add(Number(id));
    return [...all].sort((a, b) => a - b);
  }, [plan.semesters, plan.semesterOrder]);

  const totalCredits = useMemo(() => {
    let sum = 0;
    const seen = new Set<string>();
    for (const ids of Object.values(plan.semesters)) {
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        sum += courses.get(id)?.credits ?? 0;
      }
    }
    for (const id of plan.completedCourses) {
      if (seen.has(id)) continue;
      seen.add(id);
      sum += courses.get(id)?.credits ?? 0;
    }
    return sum;
  }, [plan.semesters, plan.completedCourses, courses]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{version.name}</h2>
        <p className="text-xs text-gray-600">
          מסלול: {plan.trackId ? TRACK_NAMES[plan.trackId] : '—'}
          {' · '}סה"כ נ"ז: {totalCredits.toFixed(1)}
          {' · '}מספר סמסטרים: {semesterIds.length}
        </p>
      </div>

      {semesterIds.map((semId) => (
        <SemesterBlock
          key={semId}
          semesterId={semId}
          courseIds={plan.semesters[semId] ?? []}
          courses={courses}
          grades={plan.grades}
          completedSet={completedSet}
          summerSemesters={plan.summerSemesters ?? []}
          canEdit={canEdit}
          onSetGrade={onSetGrade}
          onToggleCompleted={onToggleCompleted}
        />
      ))}

      {plan.completedCourses.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-2">קורסים שהושלמו (לא משובצים)</h3>
          <p className="text-xs text-gray-500">
            {plan.completedCourses
              .filter((id) => !Object.values(plan.semesters).flat().includes(id))
              .map((id) => courses.get(id)?.name ?? id)
              .join(', ') || '—'}
          </p>
        </div>
      )}
    </div>
  );
}

interface SemesterBlockProps {
  semesterId: number;
  courseIds: string[];
  courses: Map<string, SapCourse>;
  grades: Record<string, number>;
  completedSet: Set<string>;
  summerSemesters: number[];
  canEdit: boolean;
  onSetGrade: (courseId: string, grade: number | null) => void;
  onToggleCompleted: (courseId: string) => void;
}

function SemesterBlock({
  semesterId,
  courseIds,
  courses,
  grades,
  completedSet,
  summerSemesters,
  canEdit,
  onSetGrade,
  onToggleCompleted,
}: SemesterBlockProps) {
  const isSummer = summerSemesters.includes(semesterId);
  const label = semesterId === 0
    ? 'הושלם מראש'
    : `סמסטר ${semesterId}${isSummer ? ' (קיץ)' : ''}`;

  const semesterCredits = courseIds.reduce(
    (sum, id) => sum + (courses.get(id)?.credits ?? 0),
    0,
  );

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-800">{label}</h3>
        <span className="text-xs text-gray-500">{semesterCredits.toFixed(1)} נ"ז</span>
      </div>
      {courseIds.length === 0 ? (
        <p className="text-xs text-gray-400">אין קורסים בסמסטר זה</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {courseIds.map((courseId) => {
            const course = courses.get(courseId);
            const grade = grades[courseId];
            const completed = completedSet.has(courseId);
            return (
              <li key={courseId} className="py-1.5 flex items-center gap-2">
                {canEdit ? (
                  <input
                    type="checkbox"
                    checked={completed}
                    onChange={() => onToggleCompleted(courseId)}
                    aria-label="סומן כהושלם"
                    className="w-4 h-4"
                  />
                ) : (
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${completed ? 'bg-emerald-500' : 'bg-gray-200'}`}
                    aria-label={completed ? 'הושלם' : 'לא הושלם'}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-900 truncate block">
                    {course?.name ?? courseId}
                  </span>
                  <span className="text-xs text-gray-500" dir="ltr">{courseId}</span>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {course ? `${course.credits.toFixed(1)} נ"ז` : ''}
                </span>
                {canEdit ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={grade ?? ''}
                    placeholder="ציון"
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        onSetGrade(courseId, null);
                      } else {
                        const num = Number(raw);
                        if (Number.isFinite(num)) onSetGrade(courseId, num);
                      }
                    }}
                    className="w-16 text-xs border border-gray-200 rounded px-1.5 py-1 text-center focus:outline-none focus:border-blue-400"
                    dir="ltr"
                  />
                ) : (
                  grade !== undefined && (
                    <span className="text-xs text-gray-700 font-semibold w-10 text-center">{grade}</span>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CenteredMessage({
  children,
  tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info' | 'error';
}) {
  const cls = tone === 'error' ? 'text-red-700 bg-red-50 border-red-200' : 'text-gray-700 bg-white border-gray-200';
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
      <div className={`max-w-md w-full text-center text-sm border rounded-2xl px-6 py-8 ${cls}`}>
        {children}
      </div>
    </div>
  );
}

function CenteredCard({
  title,
  children,
  tone = 'info',
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'info' | 'error';
}) {
  const titleCls = tone === 'error' ? 'text-red-700' : 'text-gray-900';
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-8">
        <h2 className={`text-base font-bold mb-3 ${titleCls}`}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
