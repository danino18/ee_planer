import { doc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import type { StudentPlan } from '../types';

export async function savePlanToCloud(uid: string, plan: StudentPlan): Promise<void> {
  const planRef = doc(db, 'plans', uid);
  await setDoc(planRef, plan);
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
