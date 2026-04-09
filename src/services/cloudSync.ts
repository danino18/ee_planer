import { doc, onSnapshot } from 'firebase/firestore';
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

export async function savePlanToCloud(_uid: string, plan: StudentPlan): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>('/plans', stripUndefined(plan));
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
