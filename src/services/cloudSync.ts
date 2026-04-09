import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { ApiRequestError, apiClient } from './apiClient';
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

export async function savePlanToCloud(uid: string, plan: StudentPlan): Promise<{ success: boolean }> {
  void uid;
  return apiClient.post<{ success: boolean }>('/plans', stripUndefined(plan));
}

export async function loadPlanFromCloud(uid: string): Promise<StudentPlan | null> {
  void uid;

  try {
    return await apiClient.get<StudentPlan>('/plans');
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export function isRetryableSyncError(error: unknown): boolean {
  if (error instanceof ApiRequestError) {
    return error.isNetworkError || error.status === 408 || error.status === 429 || (error.status !== undefined && error.status >= 500);
  }

  return false;
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
