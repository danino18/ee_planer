import { apiClient } from './apiClient';
import type { StudentPlan } from '../types';

export async function savePlanToCloud(_uid: string, plan: StudentPlan): Promise<void> {
  await apiClient.post('/plans', plan);
}

export async function loadPlanFromCloud(_uid: string): Promise<StudentPlan | null> {
  try {
    return await apiClient.get<StudentPlan>('/plans');
  } catch (err: unknown) {
    // 404 means the user has no plan saved yet — not an error
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  }
}
