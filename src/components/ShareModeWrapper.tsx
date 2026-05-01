import { useEffect, useRef, useState } from 'react';
import { fetchShare } from '../services/shareApi';
import { usePlanStore } from '../store/planStore';
import { buildEnvelopeFromState } from '../services/planSync';
import { ShareModeContext } from '../context/ShareModeContext';
import { auth } from '../services/firebase';
import type { ShareDoc } from '../types/share';
import type { VersionedPlanEnvelope } from '../types';
import App from '../App';

const PLANNER_STORAGE_KEY = 'technion-ee-planner';

type ShareLoadState =
  | { status: 'loading' }
  | { status: 'error'; reason: 'not_found' | 'revoked' | 'expired' | 'auth_required' | 'forbidden' | 'network' }
  | { status: 'ready'; share: ShareDoc; canEdit: boolean; isOwner: boolean; envelopeLoaded: boolean };

function ShareErrorScreen({ reason }: { reason: string }) {
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

export default function ShareModeWrapper({ shareId }: { shareId: string }) {
  const [state, setState] = useState<ShareLoadState>({ status: 'loading' });
  const originalEnvelopeRef = useRef<VersionedPlanEnvelope | null>(null);
  const originalStorageRef = useRef<string | null>(null);

  useEffect(() => {
    originalEnvelopeRef.current = buildEnvelopeFromState(usePlanStore.getState());
    originalStorageRef.current = localStorage.getItem(PLANNER_STORAGE_KEY);

    let cancelled = false;

    auth.authStateReady()
      .then(() => {
        if (cancelled) return null;
        return fetchShare(shareId);
      })
      .then((response) => {
        if (!response || cancelled) return;
        if (!response.ok) {
          setState({ status: 'error', reason: response.reason });
          return;
        }

        // Detect ownership after auth is fully initialized so auth.currentUser is reliable.
        const currentUid = auth.currentUser?.uid ?? null;
        const isOwner = currentUid !== null && currentUid === response.share.ownerUid;

        let envelopeLoaded = false;
        if (!isOwner) {
          usePlanStore.getState().loadEnvelope(response.share.envelope);
          envelopeLoaded = true;
        } else {
          // Owner: load the share snapshot only if it's newer than the local plan.
          // This makes partner edits visible when the owner opens their share link,
          // while preventing a stale share snapshot from overwriting fresher local edits.
          const shareUpdatedAt = Math.max(...response.share.envelope.versions.map((v) => v.updatedAt));
          const localUpdatedAt = Math.max(
            ...buildEnvelopeFromState(usePlanStore.getState()).versions.map((v) => v.updatedAt),
          );
          if (shareUpdatedAt > localUpdatedAt) {
            usePlanStore.getState().loadEnvelope(response.share.envelope);
            usePlanStore.getState().markCloudSyncPending(shareUpdatedAt);
            envelopeLoaded = true;
          }
        }

        setState({
          status: 'ready',
          share: response.share,
          canEdit: response.canEdit,
          isOwner,
          envelopeLoaded,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', reason: 'network' });
      });

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
      // Only restore the store if we actually overwrote it with the share snapshot
      if (
        state.status === 'ready' &&
        state.envelopeLoaded &&
        originalEnvelopeRef.current
      ) {
        usePlanStore.getState().loadEnvelope(originalEnvelopeRef.current);
        restoreStorage();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <ShareModeContext.Provider
      value={{
        shareId,
        canEdit: state.canEdit,
        share: state.share,
        isOwner: state.isOwner,
      }}
    >
      <App />
    </ShareModeContext.Provider>
  );
}
