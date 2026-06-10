import { useEffect, useMemo, useState } from 'react';
import {
  averageRank,
  buildInstructorClusters,
  extractInstructorNames,
  fetchCheeseForkFeedback,
  formatCheeseForkDate,
  formatCheeseForkSemester,
  peekCheeseForkFeedback,
  type CheeseForkFeedback,
  type CheeseForkPost,
} from '../services/cheesefork';
import { usePlanStore } from '../store/planStore';

interface Props {
  courseId: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; feedback: CheeseForkFeedback }
  | { status: 'empty' }
  | { status: 'hidden' };

type Role = 'lecturer' | 'ta' | 'semester';

interface ParsedPost {
  post: CheeseForkPost;
  lecturerRaw: string | null;
  taRaw: string | null;
}

interface NameOption {
  name: string;        // storage key (used in the selected set)
  count: number;
  label?: string;      // optional display override (e.g. formatted semester)
}

interface MergeSuggestion {
  clusterKey: string;
  rawNames: string[];
  canonicalName: string;
}

function resolveCached(feedback: CheeseForkFeedback | null | undefined): LoadState {
  if (feedback === undefined) return { status: 'loading' };
  if (feedback === null || feedback.posts.length === 0) return { status: 'empty' };
  return { status: 'ready', feedback };
}

function applyAlias(rawName: string | null, aliases: Record<string, string>): string | null {
  if (!rawName) return null;
  return aliases[rawName] ?? rawName;
}

function buildOptions(posts: ParsedPost[], pick: (p: ParsedPost) => string | null): NameOption[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    const name = pick(p);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'he'));
}

/**
 * Group raw names into merge clusters using token-set equality plus
 * one-direction strict-subset matching (so "ניר" can merge into "ניר קציר"
 * when that's the only superset). Skips clusters the user already dismissed
 * or already mapped to a single canonical name via aliases.
 */
function buildSuggestions(
  posts: ParsedPost[],
  pickRaw: (p: ParsedPost) => string | null,
  aliases: Record<string, string>,
  dismissed: string[],
): MergeSuggestion[] {
  const rawCounts = new Map<string, number>();
  for (const p of posts) {
    const raw = pickRaw(p);
    if (!raw) continue;
    rawCounts.set(raw, (rawCounts.get(raw) ?? 0) + 1);
  }
  const clusters = buildInstructorClusters(rawCounts);
  const suggestions: MergeSuggestion[] = [];
  for (const cluster of clusters) {
    if (dismissed.includes(cluster.clusterKey)) continue;
    const canonicalNames = new Set(cluster.rawNames.map((raw) => aliases[raw] ?? raw));
    if (canonicalNames.size <= 1) continue; // already merged via aliases
    suggestions.push({
      clusterKey: cluster.clusterKey,
      rawNames: cluster.rawNames,
      canonicalName: cluster.canonicalName,
    });
  }
  return suggestions;
}

interface FilterChipProps {
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
  onClear?: () => void;
}

function FilterChip({ label, active, open, onClick, onClear }: FilterChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs border rounded-full transition-colors ${
        active
          ? 'bg-sky-100 text-sky-700 border-sky-300'
          : open
            ? 'bg-gray-100 text-gray-700 border-gray-300'
            : 'bg-white text-gray-500 border-gray-200 hover:border-sky-300'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="px-2 py-1 leading-none"
      >
        {label} <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="נקה סינון"
          className="pe-1.5 -ms-1 text-sky-600 hover:text-sky-900 leading-none"
        >
          ×
        </button>
      )}
    </span>
  );
}

interface FilterMenuPanelProps {
  options: NameOption[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onClear: () => void;
  suggestions: MergeSuggestion[];
  onMerge: (s: MergeSuggestion) => void;
  onDismiss: (s: MergeSuggestion) => void;
  emptyLabel: string;
}

function FilterMenuPanel({
  options, selected, onToggle, onClear, suggestions, onMerge, onDismiss, emptyLabel,
}: FilterMenuPanelProps) {
  return (
    <div className="mt-1 mb-2 border border-gray-200 rounded-md bg-white p-1.5 text-xs">
      <button
        type="button"
        onClick={onClear}
        className={`block w-full text-start px-2 py-1 rounded ${
          selected.size === 0 ? 'bg-sky-50 text-sky-700' : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        הכל
      </button>
      {options.length === 0 ? (
        <div className="px-2 py-1 text-gray-400 italic">{emptyLabel}</div>
      ) : (
        options.map((opt) => {
          const isOn = selected.has(opt.name);
          return (
            <button
              type="button"
              key={opt.name}
              onClick={() => onToggle(opt.name)}
              className={`flex w-full items-center justify-between px-2 py-1 rounded ${
                isOn ? 'bg-sky-50 text-sky-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`inline-block w-3 h-3 border rounded-sm shrink-0 ${
                    isOn ? 'bg-sky-600 border-sky-600 text-white' : 'border-gray-300'
                  }`}
                  aria-hidden
                >
                  {isOn && <span className="block text-[10px] leading-3 text-center">✓</span>}
                </span>
                <span className="truncate">{opt.label ?? opt.name}</span>
              </span>
              <span className="text-gray-400 ms-2">{opt.count}</span>
            </button>
          );
        })
      )}
      {suggestions.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-1.5">
          {suggestions.map((s) => (
            <div key={s.clusterKey} className="bg-amber-50 border border-amber-200 rounded p-1.5">
              <div className="text-amber-900 mb-1">
                <span className="font-semibold">מוצע לאיחוד: </span>
                <span>{s.rawNames.map((n) => `"${n}"`).join(' / ')}</span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onMerge(s)}
                  className="px-2 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700"
                >
                  ✓ אחד תחת "{s.canonicalName}"
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(s)}
                  className="px-2 py-0.5 rounded border border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  בטל
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CheeseForkInfo({ courseId }: Props) {
  const [trackedId, setTrackedId] = useState(courseId);
  const [state, setState] = useState<LoadState>(() =>
    resolveCached(peekCheeseForkFeedback(courseId)),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedLecturers, setSelectedLecturers] = useState<Set<string>>(() => new Set());
  const [selectedTAs, setSelectedTAs] = useState<Set<string>>(() => new Set());
  const [selectedSemesters, setSelectedSemesters] = useState<Set<string>>(() => new Set());
  const [openMenu, setOpenMenu] = useState<Role | null>(null);

  const lecturerAliases = usePlanStore(
    (s) => s.reviewLecturerAliases?.[courseId] ?? EMPTY_ALIASES,
  );
  const taAliases = usePlanStore(
    (s) => s.reviewTAAliases?.[courseId] ?? EMPTY_ALIASES,
  );
  const dismissed = usePlanStore(
    (s) => s.reviewDismissedNameSuggestions?.[courseId] ?? EMPTY_DISMISSED,
  );
  const mergeReviewLecturerAliases = usePlanStore((s) => s.mergeReviewLecturerAliases);
  const mergeReviewTAAliases = usePlanStore((s) => s.mergeReviewTAAliases);
  const dismissReviewNameSuggestion = usePlanStore((s) => s.dismissReviewNameSuggestion);

  if (courseId !== trackedId) {
    setTrackedId(courseId);
    setState(resolveCached(peekCheeseForkFeedback(courseId)));
    setCurrentIndex(0);
    setSelectedLecturers(new Set());
    setSelectedTAs(new Set());
    setSelectedSemesters(new Set());
    setOpenMenu(null);
  }

  useEffect(() => {
    if (peekCheeseForkFeedback(courseId) !== undefined) return;
    let cancelled = false;
    fetchCheeseForkFeedback(courseId)
      .then((feedback) => { if (!cancelled) setState(resolveCached(feedback)); })
      .catch(() => { if (!cancelled) setState({ status: 'hidden' }); });
    return () => { cancelled = true; };
  }, [courseId]);

  const posts = useMemo(
    () => (state.status === 'ready' ? state.feedback.posts : []),
    [state],
  );

  const parsedPosts: ParsedPost[] = useMemo(
    () => posts.map((post) => {
      const { lecturer, ta } = extractInstructorNames(post.text);
      return { post, lecturerRaw: lecturer, taRaw: ta };
    }),
    [posts],
  );

  const lecturerOptions = useMemo(
    () => buildOptions(parsedPosts, (p) => applyAlias(p.lecturerRaw, lecturerAliases)),
    [parsedPosts, lecturerAliases],
  );
  const taOptions = useMemo(
    () => buildOptions(parsedPosts, (p) => applyAlias(p.taRaw, taAliases)),
    [parsedPosts, taAliases],
  );

  const semesterOptions: NameOption[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of parsedPosts) {
      const sem = p.post.semester;
      if (!sem) continue;
      counts.set(sem, (counts.get(sem) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count, label: formatCheeseForkSemester(name) }))
      .sort((a, b) => b.name.localeCompare(a.name));
  }, [parsedPosts]);

  const lecturerSuggestions = useMemo(
    () => buildSuggestions(parsedPosts, (p) => p.lecturerRaw, lecturerAliases, dismissed),
    [parsedPosts, lecturerAliases, dismissed],
  );
  const taSuggestions = useMemo(
    () => buildSuggestions(parsedPosts, (p) => p.taRaw, taAliases, dismissed),
    [parsedPosts, taAliases, dismissed],
  );

  const filteredPosts = useMemo(() => {
    let arr = parsedPosts;
    if (selectedLecturers.size > 0) {
      arr = arr.filter((p) => {
        const name = applyAlias(p.lecturerRaw, lecturerAliases);
        return name !== null && selectedLecturers.has(name);
      });
    }
    if (selectedTAs.size > 0) {
      arr = arr.filter((p) => {
        const name = applyAlias(p.taRaw, taAliases);
        return name !== null && selectedTAs.has(name);
      });
    }
    if (selectedSemesters.size > 0) {
      arr = arr.filter((p) => p.post.semester && selectedSemesters.has(p.post.semester));
    }
    return [...arr].sort((a, b) => b.post.timestamp - a.post.timestamp).map((p) => p.post);
  }, [parsedPosts, selectedLecturers, selectedTAs, selectedSemesters, lecturerAliases, taAliases]);

  if (state.status === 'hidden') return null;

  const difficultyValues = posts
    .map((p) => p.difficultyRank)
    .filter((n): n is number => n !== null);
  const generalValues = posts
    .map((p) => p.generalRank)
    .filter((n): n is number => n !== null);
  const difficultyAvg = averageRank(difficultyValues);
  const generalAvg = averageRank(generalValues);

  const safeIndex = Math.min(currentIndex, Math.max(filteredPosts.length - 1, 0));
  const currentPost = filteredPosts[safeIndex];
  const hasPosts = filteredPosts.length > 0;
  const canGoNewer = hasPosts && safeIndex > 0;
  const canGoOlder = hasPosts && safeIndex < filteredPosts.length - 1;
  const hasFilter =
    selectedLecturers.size > 0 || selectedTAs.size > 0 || selectedSemesters.size > 0;
  const totalAvailable = posts.length;
  const showFilterRow =
    state.status === 'ready' &&
    (lecturerOptions.length > 0 || taOptions.length > 0 || semesterOptions.length > 0 ||
      lecturerSuggestions.length > 0 || taSuggestions.length > 0 || hasFilter);

  const handleMergeLecturer = (s: MergeSuggestion) => {
    const mapping: Record<string, string> = {};
    for (const raw of s.rawNames) {
      if (raw !== s.canonicalName) mapping[raw] = s.canonicalName;
    }
    mergeReviewLecturerAliases(courseId, mapping);
    // Remap any active selections so the merge doesn't silently drop them.
    setSelectedLecturers((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set<string>();
      for (const name of prev) {
        if (s.rawNames.includes(name) && name !== s.canonicalName) {
          next.add(s.canonicalName);
          changed = true;
        } else {
          next.add(name);
        }
      }
      return changed ? next : prev;
    });
    setCurrentIndex(0);
  };
  const handleMergeTA = (s: MergeSuggestion) => {
    const mapping: Record<string, string> = {};
    for (const raw of s.rawNames) {
      if (raw !== s.canonicalName) mapping[raw] = s.canonicalName;
    }
    mergeReviewTAAliases(courseId, mapping);
    setSelectedTAs((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set<string>();
      for (const name of prev) {
        if (s.rawNames.includes(name) && name !== s.canonicalName) {
          next.add(s.canonicalName);
          changed = true;
        } else {
          next.add(name);
        }
      }
      return changed ? next : prev;
    });
    setCurrentIndex(0);
  };
  const toggleLecturer = (name: string) => {
    setSelectedLecturers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
    setCurrentIndex(0);
  };
  const toggleTA = (name: string) => {
    setSelectedTAs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
    setCurrentIndex(0);
  };
  const clearLecturers = () => {
    setSelectedLecturers(new Set());
    setCurrentIndex(0);
  };
  const clearTAs = () => {
    setSelectedTAs(new Set());
    setCurrentIndex(0);
  };
  const toggleSemester = (name: string) => {
    setSelectedSemesters((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
    setCurrentIndex(0);
  };
  const clearSemesters = () => {
    setSelectedSemesters(new Set());
    setCurrentIndex(0);
  };

  const lecturerChipLabel = selectedLecturers.size === 0
    ? 'מרצה'
    : selectedLecturers.size === 1
      ? `מרצה: ${selectedLecturers.values().next().value}`
      : `מרצה (${selectedLecturers.size})`;
  const taChipLabel = selectedTAs.size === 0
    ? 'מתרגל'
    : selectedTAs.size === 1
      ? `מתרגל: ${selectedTAs.values().next().value}`
      : `מתרגל (${selectedTAs.size})`;
  const semesterChipLabel = selectedSemesters.size === 0
    ? 'סמסטר'
    : selectedSemesters.size === 1
      ? `סמסטר: ${formatCheeseForkSemester(selectedSemesters.values().next().value as string)}`
      : `סמסטר (${selectedSemesters.size})`;

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
              <div className="text-xs text-gray-500">קושי</div>
              <div className="text-sm font-bold text-gray-800">
                {difficultyAvg !== null ? `${difficultyAvg} / 5` : '—'}
              </div>
              <div className="text-xs text-gray-400">
                {difficultyValues.length} {difficultyValues.length === 1 ? 'ביקורת' : 'ביקורות'}
              </div>
            </div>
            <div className="rounded-md bg-gray-50 border border-gray-200 px-2 py-1.5 text-center">
              <div className="text-xs text-gray-500">כללי</div>
              <div className="text-sm font-bold text-gray-800">
                {generalAvg !== null ? `${generalAvg} / 5` : '—'}
              </div>
              <div className="text-xs text-gray-400">
                {generalValues.length} {generalValues.length === 1 ? 'ביקורת' : 'ביקורות'}
              </div>
            </div>
          </div>

          {showFilterRow && (
            <>
              <div className="flex flex-wrap gap-1.5 mb-1 items-center">
                <FilterChip
                  label={lecturerChipLabel}
                  active={selectedLecturers.size > 0}
                  open={openMenu === 'lecturer'}
                  onClick={() => setOpenMenu(openMenu === 'lecturer' ? null : 'lecturer')}
                  onClear={selectedLecturers.size > 0 ? clearLecturers : undefined}
                />
                <FilterChip
                  label={taChipLabel}
                  active={selectedTAs.size > 0}
                  open={openMenu === 'ta'}
                  onClick={() => setOpenMenu(openMenu === 'ta' ? null : 'ta')}
                  onClear={selectedTAs.size > 0 ? clearTAs : undefined}
                />
                <FilterChip
                  label={semesterChipLabel}
                  active={selectedSemesters.size > 0}
                  open={openMenu === 'semester'}
                  onClick={() => setOpenMenu(openMenu === 'semester' ? null : 'semester')}
                  onClear={selectedSemesters.size > 0 ? clearSemesters : undefined}
                />
                {hasFilter && (
                  <span className="text-xs text-gray-400">
                    {filteredPosts.length}/{totalAvailable}
                  </span>
                )}
              </div>

              {openMenu === 'lecturer' && (
                <FilterMenuPanel
                  options={lecturerOptions}
                  selected={selectedLecturers}
                  onToggle={toggleLecturer}
                  onClear={clearLecturers}
                  suggestions={lecturerSuggestions}
                  onMerge={handleMergeLecturer}
                  onDismiss={(s) => dismissReviewNameSuggestion(courseId, s.clusterKey)}
                  emptyLabel="לא זוהו שמות מרצים בביקורות"
                />
              )}
              {openMenu === 'ta' && (
                <FilterMenuPanel
                  options={taOptions}
                  selected={selectedTAs}
                  onToggle={toggleTA}
                  onClear={clearTAs}
                  suggestions={taSuggestions}
                  onMerge={handleMergeTA}
                  onDismiss={(s) => dismissReviewNameSuggestion(courseId, s.clusterKey)}
                  emptyLabel="לא זוהו שמות מתרגלים בביקורות"
                />
              )}
              {openMenu === 'semester' && (
                <FilterMenuPanel
                  options={semesterOptions}
                  selected={selectedSemesters}
                  onToggle={toggleSemester}
                  onClear={clearSemesters}
                  suggestions={EMPTY_SUGGESTIONS}
                  onMerge={noop}
                  onDismiss={noop}
                  emptyLabel="אין סמסטרים בביקורות"
                />
              )}
            </>
          )}

          {!hasPosts && hasFilter && (
            <p className="text-xs text-gray-400 italic">אין ביקורות תואמות לסינון</p>
          )}

          {currentPost && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.min(i + 1, filteredPosts.length - 1))}
                  disabled={!canGoOlder}
                  aria-label="ביקורת ישנה יותר"
                  className="text-gray-500 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed text-sm leading-none px-1"
                >
                  ◀
                </button>
                <span className="text-xs text-gray-500">
                  ביקורת {safeIndex + 1} מתוך {filteredPosts.length}
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
                <div className="text-xs font-medium text-gray-700">
                  {formatCheeseForkSemester(currentPost.semester)}
                </div>
              )}

              <div className="text-xs text-gray-500 mb-1.5">
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
                <div className="text-xs text-gray-500 mt-1.5 flex gap-3">
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

const EMPTY_ALIASES: Record<string, string> = {};
const EMPTY_DISMISSED: string[] = [];
const EMPTY_SUGGESTIONS: MergeSuggestion[] = [];
const noop = () => {};
