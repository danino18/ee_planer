import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { parseShareHash } from './services/shareRouting'
import { fetchShare } from './services/shareApi'
import { usePlanStore } from './store/planStore'
import { buildEnvelopeFromState } from './services/planSync'
import { ShareModeContext } from './context/ShareModeContext'
import type { ShareDoc } from './types/share'
import type { VersionedPlanEnvelope } from './types'

const App = lazy(() => import('./App'));

const PLANNER_STORAGE_KEY = 'technion-ee-planner';

type ShareLoadState =
  | { status: 'loading' }
  | { status: 'error'; reason: 'not_found' | 'revoked' | 'expired' | 'auth_required' | 'forbidden' | 'network' }
  | { status: 'ready'; share: ShareDoc; canEdit: boolean };

function ShareErrorScreen({ reason }: { reason: ShareLoadState & { status: 'error' } extends { reason: infer R } ? R : never }) {
  const messages: Record<string, string> = {
    not_found: 'הקישור לא נמצא או נמחק.',
    revoked: 'הקישור בוטל על ידי בעל התוכנית.',
    expired: 'הקישור פג תוקף.',
    auth_required: 'הקישור דורש התחברות. פתח אותו דרך הדפדפן לאחר התחברות.',
    forbidden: 'אין לך הרשאה לצפות בקישור הזה.',
    network: 'שגיאה בטעינת הקישור. בדוק את חיבור האינטרנט ונסה שנית.',
  };
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full text-center text-sm border border-red-200 rounded-2xl px-6 py-8 bg-red-50 text-red-700">
        <p className="font-semibold text-base mb-2">שגיאה בפתיחת הקישור</p>
        <p>{messages[reason] ?? 'שגיאה לא צפויה.'}</p>
        <a
          href={window.location.origin}
          className="mt-4 inline-block text-blue-600 hover:text-blue-800 underline text-xs"
        >עבור למתכנן שלי</a>
      </div>
    </div>
  );
}

function ShareModeWrapper({ shareId }: { shareId: string }) {
  const [state, setState] = useState<ShareLoadState>({ status: 'loading' });
  const originalEnvelopeRef = useRef<VersionedPlanEnvelope | null>(null);
  const originalStorageRef = useRef<string | null>(null);

  useEffect(() => {
    // Capture the user's own plan before overwriting with share data
    originalEnvelopeRef.current = buildEnvelopeFromState(usePlanStore.getState());
    originalStorageRef.current = localStorage.getItem(PLANNER_STORAGE_KEY);

    let cancelled = false;

    fetchShare(shareId)
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          setState({ status: 'error', reason: response.reason });
          return;
        }
        // Load the share's envelope into the store so the full App renders it
        usePlanStore.getState().loadEnvelope(response.share.envelope);
        setState({ status: 'ready', share: response.share, canEdit: response.canEdit });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', reason: 'network' });
      });

    // Restore on page close so localStorage isn't left with share data
    const restoreStorage = () => {
      if (originalStorageRef.current !== null) {
        localStorage.setItem(PLANNER_STORAGE_KEY, originalStorageRef.current);
      } else {
        localStorage.removeItem(PLANNER_STORAGE_KEY);
      }
    };
    window.addEventListener('beforeunload', restoreStorage);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', restoreStorage);
      // Restore the user's own plan in the store
      if (originalEnvelopeRef.current) {
        usePlanStore.getState().loadEnvelope(originalEnvelopeRef.current);
      }
      restoreStorage();
    };
  }, [shareId]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600 text-sm">טוען תוכנית משותפת...</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return <ShareErrorScreen reason={state.reason} />;
  }

  return (
    <ShareModeContext.Provider value={{ shareId, canEdit: state.canEdit, share: state.share }}>
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </ShareModeContext.Provider>
  );
}

export default function Root() {
  const [shareRoute, setShareRoute] = useState(() => parseShareHash());

  useEffect(() => {
    function onHashChange() {
      setShareRoute(parseShareHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (shareRoute) {
    return <ShareModeWrapper shareId={shareRoute.shareId} />;
  }

  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}
