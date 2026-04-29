import { auth } from './firebase';

export class ApiRequestError extends Error {
  status?: number;
  isNetworkError: boolean;
  url: string;

  constructor(
    message: string,
    options: {
      status?: number;
      isNetworkError?: boolean;
      url: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.isNetworkError = options.isNetworkError ?? false;
    this.url = options.url;
    this.cause = options.cause;
  }
}

/**
 * Base URL for the Firebase Cloud Functions API.
 * In development with the emulator, set VITE_FUNCTIONS_EMULATOR_URL in .env.local
 * e.g.: VITE_FUNCTIONS_EMULATOR_URL=http://127.0.0.1:5001/YOUR_PROJECT_ID/us-central1/api
 *
 * In production this is automatically derived from the Firebase project.
 */
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function getBaseUrls(): string[] {
  const urls: string[] = [];
  const configuredBaseUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL;
  if (configuredBaseUrl) {
    urls.push(normalizeBaseUrl(configuredBaseUrl));
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (projectId) {
    urls.push(normalizeBaseUrl(`https://us-central1-${projectId}.cloudfunctions.net/api`));
  }

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.web.app') ||
      hostname.endsWith('.firebaseapp.com')
    ) {
      urls.push(normalizeBaseUrl(`${origin}/api`));
    }
  }

  return [...new Set(urls)];
}

async function getIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken(forceRefresh);
}

async function getOptionalIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

async function sendRequest<T>(
  baseUrl: string,
  token: string | null,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiRequestError('Failed to reach sync service', {
      isNetworkError: true,
      url,
      cause: error,
    });
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiRequestError(err.error ?? `HTTP ${response.status}`, {
      status: response.status,
      url,
    });
  }

  return response.json() as Promise<T>;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: { authMode?: 'required' | 'optional' } = {},
): Promise<T> {
  const baseUrls = getBaseUrls();
  if (baseUrls.length === 0) {
    throw new ApiRequestError('Sync service is not configured', {
      url: path,
    });
  }

  const authMode = options.authMode ?? 'required';
  let token: string | null;
  if (authMode === 'required') {
    token = await getIdToken();
  } else {
    token = await getOptionalIdToken();
  }
  let lastNetworkError: ApiRequestError | null = null;

  for (const baseUrl of baseUrls) {
    try {
      return await sendRequest<T>(baseUrl, token, method, path, body);
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        throw error;
      }

      if (error.status === 401 && token) {
        token = authMode === 'required'
          ? await getIdToken(true)
          : await getOptionalIdToken(true);
        return sendRequest<T>(baseUrl, token, method, path, body);
      }

      if (error.isNetworkError) {
        lastNetworkError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastNetworkError ?? new ApiRequestError('Sync service is unavailable', {
    isNetworkError: true,
    url: path,
  });
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),

  // Variants that send the auth header only when a user is signed in.
  getPublic: <T>(path: string) => request<T>('GET', path, undefined, { authMode: 'optional' }),
  putPublic: <T>(path: string, body: unknown) => request<T>('PUT', path, body, { authMode: 'optional' }),
};
