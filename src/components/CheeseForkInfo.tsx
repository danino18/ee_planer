import { useEffect, useState } from 'react';
import {
  buildCheeseForkUrl,
  fetchCheeseForkFeedback,
  peekCheeseForkFeedback,
  pickCheeseForkSemester,
  type CheeseForkFeedback,
} from '../services/cheesefork';

interface Props {
  courseId: string;
  fallbackSemester?: string | null;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; feedback: CheeseForkFeedback }
  | { status: 'empty' }
  | { status: 'hidden' };

function resolveCached(feedback: CheeseForkFeedback | null | undefined): LoadState {
  if (feedback === undefined) return { status: 'loading' };
  if (feedback === null || feedback.posts.length === 0) return { status: 'empty' };
  return { status: 'ready', feedback };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function CheeseForkInfo({ courseId, fallbackSemester }: Props) {
  const [trackedId, setTrackedId] = useState(courseId);
  const [state, setState] = useState<LoadState>(() =>
    resolveCached(peekCheeseForkFeedback(courseId)),
  );

  // Reset-on-prop-change (state setter in render, React-idiomatic).
  if (courseId !== trackedId) {
    setTrackedId(courseId);
    setState(resolveCached(peekCheeseForkFeedback(courseId)));
  }

  useEffect(() => {
    if (peekCheeseForkFeedback(courseId) !== undefined) return;
    let cancelled = false;
    fetchCheeseForkFeedback(courseId)
      .then((feedback) => { if (!cancelled) setState(resolveCached(feedback)); })
      .catch(() => { if (!cancelled) setState({ status: 'hidden' }); });
    return () => { cancelled = true; };
  }, [courseId]);

  if (state.status === 'hidden') return null;

  const posts = state.status === 'ready' ? state.feedback.posts : [];
  const semesterForLink = pickCheeseForkSemester(posts, fallbackSemester ?? null);
  const url = buildCheeseForkUrl(courseId, semesterForLink);

  const difficultyValues = posts
    .map((p) => p.difficultyRank)
    .filter((n): n is number => n !== null);
  const generalValues = posts
    .map((p) => p.generalRank)
    .filter((n): n is number => n !== null);
  const difficultyAvg = average(difficultyValues);
  const generalAvg = average(generalValues);

  return (
    <div className="mb-4 border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">ביקורות בציזפורק</p>

      {state.status === 'loading' && (
        <p className="text-xs text-gray-400 italic">טוען…</p>
      )}

      {state.status === 'empty' && (
        <p className="text-xs text-gray-400 italic mb-2">אין עדיין ביקורות בציזפורק</p>
      )}

      {state.status === 'ready' && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded-md bg-gray-50 border border-gray-200 px-2 py-1.5 text-center">
            <div className="text-[10px] text-gray-500">קושי</div>
            <div className="text-sm font-bold text-gray-800">
              {difficultyAvg !== null ? `${difficultyAvg} / 5` : '—'}
            </div>
            <div className="text-[10px] text-gray-400">
              {difficultyValues.length} {difficultyValues.length === 1 ? 'ביקורת' : 'ביקורות'}
            </div>
          </div>
          <div className="rounded-md bg-gray-50 border border-gray-200 px-2 py-1.5 text-center">
            <div className="text-[10px] text-gray-500">כללי</div>
            <div className="text-sm font-bold text-gray-800">
              {generalAvg !== null ? `${generalAvg} / 5` : '—'}
            </div>
            <div className="text-[10px] text-gray-400">
              {generalValues.length} {generalValues.length === 1 ? 'ביקורת' : 'ביקורות'}
            </div>
          </div>
        </div>
      )}

      {state.status !== 'loading' && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-500 hover:text-blue-700 hover:underline inline-block"
        >
          קרא ביקורות בציזפורק ↗
        </a>
      )}
    </div>
  );
}
