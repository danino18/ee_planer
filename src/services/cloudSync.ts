import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { StudentPlan, VersionedPlanEnvelope } from '../types';
import { sanitizeStudentPlan, sanitizeEnvelope } from './planValidation';

type FirestoreLikeError = Error & { code?: string };

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)]),
    ) as T;
  }

  return value;
}

export function isRetryableSyncError(error: unknown): boolean {
  const code = (error as FirestoreLikeError | undefined)?.code;
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'resource-exhausted' ||
    code === 'aborted' ||
    code === 'failed-precondition'
  );
}

export async function savePlanToCloud(uid: string, envelope: VersionedPlanEnvelope): Promise<{ success: boolean }> {
  const planRef = doc(db, 'plans', uid);
  await setDoc(planRef, stripUndefined(envelope));
  return { success: true };
}

function wrapPlanAsEnvelope(plan: StudentPlan): VersionedPlanEnvelope {
  const vId = crypto.randomUUID();
  return {
    schemaVersion: 2,
    versions: [{ id: vId, name: 'גרסה 1', plan, createdAt: Date.now(), updatedAt: Date.now() }],
    activeVersionId: vId,
  };
}

export function subscribeToCloudPlan(
  uid: string,
  onData: (envelope: VersionedPlanEnvelope) => void,
  onNotFound: () => void,
  onError?: (error: Error) => void,
): () => void {
  const planRef = doc(db, 'plans', uid);
  return onSnapshot(
    planRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        // New envelope format
        if (data.schemaVersion === 2 && Array.isArray(data.versions)) {
          const envelope = sanitizeEnvelope(data);
          if (!envelope) {
            const error = new Error('Cloud plan envelope payload is invalid');
            console.error('[cloudSync] invalid envelope payload:', data);
            onError?.(error);
            return;
          }
          onData(envelope);
          return;
        }

        // Legacy flat plan — wrap it
        const plan = sanitizeStudentPlan(data);
        if (!plan) {
          const error = new Error('Cloud plan payload is invalid');
          console.error('[cloudSync] invalid plan payload:', data);
          onError?.(error);
          return;
        }
        onData(wrapPlanAsEnvelope(plan));
      } else {
        onNotFound();
      }
    },
    (error) => {
      console.error('[cloudSync] onSnapshot error:', error);
      onError?.(error);
    },
  );
}
