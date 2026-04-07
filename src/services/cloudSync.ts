import { doc, onSnapshot } from 'firebase/firestore';
import { apiClient } from './apiClient';
import { db } from './firebase';
import type { StudentPlan } from '../types';

export async function savePlanToCloud(_uid: string, plan: StudentPlan): Promise<void> {
  await apiClient.post('/plans', plan);
}

/**
 * Subscribe to real-time updates of the user's plan in Firestore.
 * - `onData` is called immediately with the current plan, and again whenever
 *   another device saves a new version.
 * - `onNotFound` is called once if the document doesn't exist yet (first login).
 * Returns an unsubscribe function.
 */
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
