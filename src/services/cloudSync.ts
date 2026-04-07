import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { apiClient } from './apiClient';
import { db } from './firebase';
import type { StudentPlan } from '../types';

export async function savePlanToCloud(uid: string, plan: StudentPlan): Promise<void> {
  void uid;
  await apiClient.post('/plans', plan);
}

export async function loadPlanFromCloud(uid: string): Promise<StudentPlan | null> {
  void uid;
  try {
    return await apiClient.get<StudentPlan>('/plans');
  } catch (err: unknown) {
    // 404 means the user has no plan saved yet — not an error
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  }
}

export function subscribePlanFromCloud(
  uid: string,
  onPlan: (plan: StudentPlan) => void,
  onMissingPlan: () => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'plans', uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onMissingPlan();
        return;
      }
      onPlan(snapshot.data() as StudentPlan);
    },
    onError
  );
}
