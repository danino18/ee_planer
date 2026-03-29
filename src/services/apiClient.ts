import { auth } from './firebase';

/**
 * Base URL for the Firebase Cloud Functions API.
 * In development with the emulator, set VITE_FUNCTIONS_EMULATOR_URL in .env.local
 * e.g.: VITE_FUNCTIONS_EMULATOR_URL=http://127.0.0.1:5001/YOUR_PROJECT_ID/us-central1/api
 *
 * In production this is automatically derived from the Firebase project.
 */
function getBaseUrl(): string {
  return (
    import.meta.env.VITE_FUNCTIONS_BASE_URL ??
    `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/api`
  );
}

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getIdToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
