import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { apiClient } from './apiClient';
import type { StudentPlan } from '../types';

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

function isNetworkSaveError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  );
}

export async function savePlanToCloud(uid: string, plan: StudentPlan): Promise<{ success: boolean }> {
  const sanitizedPlan = stripUndefined(plan);

  try {
    return await apiClient.post<{ success: boolean }>('/plans', sanitizedPlan);
  } catch (error) {
    if (!isNetworkSaveError(error)) {
      throw error;
    }

    console.warn('[cloudSync] API save failed, falling back to direct Firestore write:', error);
    const planRef = doc(db, 'plans', uid);
    await setDoc(planRef, sanitizedPlan);
    return { success: true };
  }
}

export function subscribeToCloudPlan(
  uid: string,
  onData: (plan: StudentPlan) => void,
  onNotFound: () => void,
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
    (error) => console.error('[cloudSync] onSnapshot error:', error),
  );
}
