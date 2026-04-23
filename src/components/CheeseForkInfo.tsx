import { useEffect, useMemo, useState } from 'react';
import {
  fetchCheeseForkFeedback,
  formatCheeseForkDate,
  formatCheeseForkSemester,
  peekCheeseForkFeedback,
  type CheeseForkFeedback,
  type CheeseForkPost,
} from '../services/cheesefork';

interface Props {
  courseId: string;
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

function sortPostsLatestFirst(posts: CheeseForkPost[]): CheeseForkPost[] {
  return [...posts].sort((a, b) => b.timestamp - a.timestamp);
}

export function CheeseForkInfo({ courseId }: Props) {
  const [trackedId, setTrackedId] = useState(courseId);
  const [state, setState] = useState<LoadState>(() =>
    resolveCached(peekCheeseForkFeedback(courseId)),
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  if (courseId !== trackedId) {
    setTrackedId(courseId);
    setState(resolveCached(peekCheeseForkFeedback(courseId)));
    setCurrentIndex(0);
  }

  useEffect(() => {
    if (peekCheeseForkFeedback(courseId) !== undefined) return;
    let cancelled = false;
    fetchCheeseForkFeedback(courseId)
      .then((feedback) => { if (!cancelled) setState(resolveCached(feedback)); })
      .catch(() => { if (!cancelled) setState({ status: 'hidden' }); });
    return () => { cancelled = true; };
  }, [courseId]);

  const sortedPosts = useMemo(
    () => (state.status === 'ready' ? sortPostsLatestFirst(state.feedback.posts) : []),
    [state],
  );
  const posts = state.status === 'ready' ? state.feedback.posts : [];

  if (state.status === 'hidden') return null;

  const difficultyValues = posts
    .map((p) => p.difficultyRank)
    .filter((n): n is number => n !== null);
  const generalValues = posts
    .map((p) => p.generalRank)
    .filter((n): n is number => n !== null);
  const difficultyAvg = average(difficultyValues);
  const generalAvg = average(generalValues);

  const safeIndex = Math.min(currentIndex, Math.max(sortedPosts.length - 1, 0));
  const currentPost = sortedPosts[safeIndex];
  const hasPosts = sortedPosts.length > 0;
  const canGoNewer = hasPosts && safeIndex > 0;
  const canGoOlder = hasPosts && safeIndex < sortedPosts.length - 1;

  return (
    <div className="mb-4 border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">ביקורות בציזפורק</p>

      {state.status === 'loading' && (
        <p className="text-xs text-gray-400 italic">טוען…</p>
      )}

      {state.status === 'empty' && (
        <p className="text-xs text-gray-400 italic">אין עדיין ביקורות בציזפורק</p>
      )}

      {state.status === 'ready' && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
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

          {currentPost && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.min(i + 1, sortedPosts.length - 1))}
                  disabled={!canGoOlder}
                  aria-label="ביקורת ישנה יותר"
                  className="text-gray-500 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed text-sm leading-none px-1"
                >
                  ◀
                </button>
                <span className="text-[11px] text-gray-500">
                  ביקורת {safeIndex + 1} מתוך {sortedPosts.length}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                  disabled={!canGoNewer}
                  aria-label="ביקורת חדשה יותר"
                  className="text-gray-500 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed text-sm leading-none px-1"
                >
                  ▶
                </button>
              </div>

              {currentPost.semester && (
                <div className="text-[11px] font-medium text-gray-700">
                  {formatCheeseForkSemester(currentPost.semester)}
                </div>
              )}

              <div className="text-[10px] text-gray-500 mb-1.5">
                {currentPost.author && <span>מאת: {currentPost.author}</span>}
                {currentPost.author && currentPost.timestamp > 0 && <span> · </span>}
                {currentPost.timestamp > 0 && <span>{formatCheeseForkDate(currentPost.timestamp)}</span>}
              </div>

              {currentPost.text && (
                <div className="text-xs text-gray-800 whitespace-pre-wrap max-h-48 overflow-y-auto bg-white border border-gray-200 rounded p-2 leading-relaxed">
                  {currentPost.text}
                </div>
              )}

              {(currentPost.difficultyRank !== null || currentPost.generalRank !== null) && (
                <div className="text-[10px] text-gray-500 mt-1.5 flex gap-3">
                  {currentPost.difficultyRank !== null && (
                    <span>קושי {currentPost.difficultyRank}/5</span>
                  )}
                  {currentPost.generalRank !== null && (
                    <span>כללי {currentPost.generalRank}/5</span>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
