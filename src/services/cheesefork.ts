const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/cheesefork-de9af/databases/(default)/documents/courseFeedback';
const CHEESEFORK_SITE = 'https://cheesefork.cf/';

export interface CheeseForkPost {
  timestamp: number;
  author: string;
  semester: string;
  text: string;
  difficultyRank: number | null;
  generalRank: number | null;
}

export interface CheeseForkFeedback {
  posts: CheeseForkPost[];
}

const cache = new Map<string, CheeseForkFeedback | null>();
const inflight = new Map<string, Promise<CheeseForkFeedback | null>>();

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } };

function unwrapFirestore(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) {
    const out: Record<string, unknown> = {};
    const fields = value.mapValue.fields ?? {};
    for (const [k, v] of Object.entries(fields)) out[k] = unwrapFirestore(v);
    return out;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(unwrapFirestore);
  }
  return undefined;
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? null : n;
  }
  return null;
}

function toStringOr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function parsePosts(raw: unknown): CheeseForkPost[] {
  if (!Array.isArray(raw)) return [];
  const posts: CheeseForkPost[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    posts.push({
      timestamp: toNumberOrNull(o.timestamp) ?? 0,
      author: toStringOr(o.author),
      semester: toStringOr(o.semester),
      text: toStringOr(o.text),
      difficultyRank: toNumberOrNull(o.difficultyRank),
      generalRank: toNumberOrNull(o.generalRank),
    });
  }
  return posts;
}

/**
 * Synchronously inspect the cache without triggering a fetch.
 * Returns `undefined` if nothing is cached yet, matching Map#get semantics.
 */
export function peekCheeseForkFeedback(
  courseId8: string,
): CheeseForkFeedback | null | undefined {
  return cache.has(courseId8) ? cache.get(courseId8) ?? null : undefined;
}

export async function fetchCheeseForkFeedback(
  courseId8: string,
): Promise<CheeseForkFeedback | null> {
  if (cache.has(courseId8)) return cache.get(courseId8) ?? null;
  const existing = inflight.get(courseId8);
  if (existing) return existing;

  const promise = (async (): Promise<CheeseForkFeedback | null> => {
    try {
      const res = await fetch(`${FIRESTORE_BASE}/${encodeURIComponent(courseId8)}`);
      if (res.status === 404) {
        cache.set(courseId8, null);
        return null;
      }
      if (!res.ok) {
        // 403, network-ish errors etc. Don't cache negatively — rules may flap.
        return null;
      }
      const json = (await res.json()) as { fields?: Record<string, FirestoreValue> };
      const unwrapped = unwrapFirestore({ mapValue: { fields: json.fields ?? {} } }) as
        | { posts?: unknown }
        | undefined;
      const posts = parsePosts(unwrapped?.posts);
      const feedback: CheeseForkFeedback = { posts };
      cache.set(courseId8, feedback);
      return feedback;
    } catch {
      return null;
    } finally {
      inflight.delete(courseId8);
    }
  })();

  inflight.set(courseId8, promise);
  return promise;
}

/**
 * Pick a semester value for the CheeseFork deep-link `?semester=` param.
 * Preference order (per plan):
 *   1. The most recent post's semester, among the 6 most-recent distinct semesters in posts.
 *   2. A caller-provided fallback (e.g. the planner's current/teaching semester).
 *   3. null → caller should omit the param.
 */
export function pickCheeseForkSemester(
  posts: CheeseForkPost[],
  fallbackSemester?: string | null,
): string | null {
  if (posts.length > 0) {
    const latestBySemester = new Map<string, number>();
    for (const p of posts) {
      if (!p.semester) continue;
      const prev = latestBySemester.get(p.semester) ?? -Infinity;
      if (p.timestamp > prev) latestBySemester.set(p.semester, p.timestamp);
    }
    const candidates = [...latestBySemester.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([sem]) => sem);
    if (candidates.length > 0) return candidates[0];
  }
  return fallbackSemester ?? null;
}

export function buildCheeseForkUrl(courseId8: string, semester: string | null): string {
  const params = new URLSearchParams();
  if (semester) params.set('semester', semester);
  params.set('course', courseId8);
  return `${CHEESEFORK_SITE}?${params.toString()}`;
}
