import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { StudentPlan } from '../types';

export async function savePlanToCloud(uid: string, plan: StudentPlan): Promise<void> {
  await setDoc(doc(db, 'plans', uid), plan);
}

export async function loadPlanFromCloud(uid: string): Promise<StudentPlan | null> {
  const snap = await getDoc(doc(db, 'plans', uid));
  return snap.exists() ? (snap.data() as StudentPlan) : null;
}
