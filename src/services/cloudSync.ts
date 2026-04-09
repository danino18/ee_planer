import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { StudentPlan } from '../types';

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

export async function savePlanToCloud(uid: string, plan: StudentPlan): Promise<{ success: boolean }> {
  const planRef = doc(db, 'plans', uid);
  await setDoc(planRef, stripUndefined(plan));
  return { success: true };
}

export function subscribeToCloudPlan(
  uid: string,
  onData: (plan: StudentPlan) => void,
  onNotFound: () => void,
  onError?: (error: Error) => void,
): () => void {
  const planRef = doc(db, 'plans', uid);
  return onSnapshot(
    planRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as StudentPlan);
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
