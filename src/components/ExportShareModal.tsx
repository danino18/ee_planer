import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlanStore } from '../store/planStore';
import type {
  SapCourse,
  TrackDefinition,
  TrackSpecializationCatalog,
  VersionedPlanEnvelope,
} from '../types';
import {
  buildExportEnvelope,
  buildExportFilename,
  downloadTextFile,
  envelopeToCsv,
  envelopeToJsonString,
  parseImportedEnvelope,
} from '../services/planExport';
import { useAuth } from '../context/AuthContext';
import { useShareMode } from '../context/ShareModeContext';
import { createShare, buildShareUrl } from '../services/shareApi';
import type { ShareAccess, SharePermission } from '../types/share';
import { ApiRequestError } from '../services/apiClient';

interface Props {
  onClose: () => void;
  onPrint: (opts: { includeGrades: boolean; versionIds: string[] }) => void;
  courses: Map<string, SapCourse>;
  trackDef: TrackDefinition | null;
  catalog: TrackSpecializationCatalog | null;
}

type Tab = 'export' | 'import' | 'share';
type VersionScope = 'current' | 'all' | 'select';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ExportShareModal({ onClose, onPrint, courses, trackDef, catalog }: Props) {
  const versions = usePlanStore((s) => s.versions);
  const activeVersionId = usePlanStore((s) => s.activeVersionId);
  const loadEnvelope = usePlanStore((s) => s.loadEnvelope);
  const { user, signInWithGoogle } = useAuth();
  const shareMode = useShareMode();
  const shareTabAllowed = !shareMode || shareMode.isOwner;

  const [tab, setTab] = useState<Tab>('export');
  const [includeGrades, setIncludeGrades] = useState(false);
  const [versionScope, setVersionScope] = useState<VersionScope>('current');
  const [selectedIds, setSelectedIds] = useState<string[]>(
    activeVersionId ? [activeVersionId] : [],
  );

  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<VersionedPlanEnvelope | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shareAccess, setShareAccess] = useState<ShareAccess>('public');
  const [sharePermission, setSharePermission] = useState<SharePermission>('view');
  const [shareIncludeGrades, setShareIncludeGrades] = useState(true);
  const [shareEmailsRaw, setShareEmailsRaw] = useState('');
  const [shareTtlMs, setShareTtlMs] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [lastSharedEmails, setLastSharedEmails] = useState<string[]>([]);
  const [lastSharedTtlMs, setLastSharedTtlMs] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!shareTabAllowed && tab === 'share') {
      setTab('export');
    }
  }, [shareTabAllowed, tab]);

  const exportVersionIds = useMemo(() => {
    if (versionScope === 'current') {
      return activeVersionId ? [activeVersionId] : [];
    }
    if (versionScope === 'all') {
      return versions.map((v) => v.id);
    }
    return selectedIds.filter((id) => versions.some((v) => v.id === id));
  }, [versionScope, activeVersionId, versions, selectedIds]);

  // Only disable when user picked "select" but hasn't ticked any version.
  // For 'current' and 'all', buildExportEnvelope always produces a valid envelope
  // (buildEnvelopeFromState creates a fallback version when versions[] is empty).
  const exportDisabled = versionScope === 'select' && selectedIds.length === 0;

  function getTrackId() {
    return usePlanStore.getState().trackId;
  }

  function buildEnvelopeForExport(): VersionedPlanEnvelope {
    return buildExportEnvelope(usePlanStore.getState(), {
      includeGrades,
      versionIds: exportVersionIds,
    });
  }

  function handleExportJson() {
    const envelope = buildEnvelopeForExport();
    const text = envelopeToJsonString(envelope);
    downloadTextFile(
      text,
      buildExportFilename(getTrackId(), 'json'),
      'application/json',
    );
  }

  function handleExportCsv() {
    const envelope = buildEnvelopeForExport();
    const text = envelopeToCsv(envelope, courses, trackDef, catalog, { includeGrades });
    downloadTextFile(
      text,
      buildExportFilename(getTrackId(), 'csv'),
      'text/csv',
    );
  }

  function handlePrint() {
    onPrint({ includeGrades, versionIds: exportVersionIds });
    onClose();
  }

  function handleFileChosen(file: File) {
    setImportError(null);
    setImportPreview(null);
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onerror = () => setImportError('שגיאה בקריאת הקובץ');
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const result = parseImportedEnvelope(text);
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      setImportPreview(result.envelope);
    };
    reader.readAsText(file);
  }

  function handleConfirmImport() {
    if (!importPreview) return;
    const localCount = versions.length;
    const importedCount = importPreview.versions.length;
    const msg = importedCount < localCount
      ? `ייבוא יחליף את התוכנית הנוכחית. ${localCount} גרסאות מקומיות יימחקו ויוחלפו ב-${importedCount}. להמשיך?`
      : 'ייבוא יחליף את התוכנית הנוכחית עם הנתונים מהקובץ. להמשיך?';
    if (!window.confirm(msg)) return;
    loadEnvelope(importPreview);
    onClose();
  }

  function toggleSelectedId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function parseEmailList(raw: string): { emails: string[]; invalid: string[] } {
    const tokens = raw
      .split(/[\s,;\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const emails: string[] = [];
    const invalid: string[] = [];
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (EMAIL_REGEX.test(lower) && lower.length <= 254) {
        if (!emails.includes(lower)) emails.push(lower);
      } else {
        invalid.push(token);
      }
    }
    return { emails, invalid };
  }

  async function handleCreateShare() {
    setShareError(null);
    setShareCopied(false);

    if (!user) {
      setShareError('יש להתחבר כדי ליצור קישור שיתוף');
      return;
    }

    let allowedEmails: string[] = [];
    if (shareAccess === 'restricted') {
      const { emails, invalid } = parseEmailList(shareEmailsRaw);
      if (invalid.length > 0) {
        setShareError(`כתובות מייל לא תקינות: ${invalid.join(', ')}`);
        return;
      }
      if (emails.length === 0) {
        setShareError('הזן לפחות כתובת מייל אחת או בחר "כולם עם הקישור"');
        return;
      }
      allowedEmails = emails;
    }

    const envelope = buildExportEnvelope(usePlanStore.getState(), {
      includeGrades: shareIncludeGrades,
      versionIds: versions.map((v) => v.id),
    });

    const expiresAt = shareTtlMs;

    setShareLoading(true);
    try {
      const { shareId } = await createShare({
        envelope,
        access: shareAccess,
        permission: sharePermission,
        allowedEmails,
        expiresAt,
      });
      setShareUrl(buildShareUrl(shareId));
      setLastSharedEmails(allowedEmails);
      setLastSharedTtlMs(shareTtlMs);
    } catch (err) {
      const message = err instanceof ApiRequestError
        ? err.message
        : 'יצירת הקישור נכשלה. נסה שנית.';
      setShareError(message);
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCopyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareError('העתקה נכשלה. סמן את הקישור והעתק ידנית.');
    }
  }

  function handleSendShareEmail() {
    if (!shareUrl || lastSharedEmails.length === 0) return;
    const senderName = user?.displayName?.trim() || user?.email || 'משתמש המתכנן';
    const subject = 'הנה הקישור למערכת הלימודים שלי בטכניון';
    const lines: string[] = [
      'היי,',
      `שיתפתי איתך את מערכת הלימודים שלי במתכנן הטכניון.`,
      `קישור: ${shareUrl}`,
    ];
    if (lastSharedTtlMs !== null) {
      const days = Math.max(1, Math.round(lastSharedTtlMs / 86400000));
      const expiryDate = new Date(Date.now() + lastSharedTtlMs).toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      lines.push(`הקישור זמין למשך ${days} ימים (עד ${expiryDate}).`);
    } else {
      lines.push('הקישור ללא הגבלת זמן.');
    }
    lines.push(`נשלח על-ידי: ${senderName}`);
    const body = lines.join('\n');
    const to = lastSharedEmails.join(',');
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const importedPlanSummary = useMemo(() => {
    if (!importPreview) return null;
    const active = importPreview.versions.find((v) => v.id === importPreview.activeVersionId);
    const planCourseCount = active
      ? new Set([
          ...active.plan.completedCourses,
          ...Object.values(active.plan.semesters).flat(),
        ]).size
      : 0;
    return {
      versionCount: importPreview.versions.length,
      activeName: active?.name ?? '—',
      trackId: active?.plan.trackId ?? null,
      courseCount: planCourseCount,
    };
  }, [importPreview]);

  const localVersionsWillBeLost = !!importPreview && versions.length > importPreview.versions.length;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">שיתוף וייצוא מערכת</h3>
            <p className="text-xs text-gray-500 mt-0.5">ייצא את התוכנית שלך לקובץ, או ייבא תוכנית קיימת</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none mr-2"
            aria-label="סגור"
          >✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          <button
            onClick={() => setTab('export')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'export'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >ייצוא</button>
          <button
            onClick={() => setTab('import')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'import'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >ייבוא</button>
          {shareTabAllowed && (
            <button
              onClick={() => setTab('share')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'share'
                  ? 'border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >שיתוף קישור</button>
          )}
        </div>

        {tab === 'export' && (
          <div className="space-y-4">
            {/* Grades option */}
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeGrades}
                onChange={(e) => setIncludeGrades(e.target.checked)}
                className="mt-0.5 w-4 h-4"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-800">כלול ציונים</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  ללא סימון — הציונים לא יופיעו בקובץ. שים לב: ייבוא חזרה לא ישחזר ציונים.
                </p>
              </div>
            </label>

            {/* Versions scope */}
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">גרסאות לייצוא</p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={versionScope === 'current'}
                    onChange={() => setVersionScope('current')}
                    className="w-4 h-4"
                  />
                  <span>הגרסה הפעילה בלבד</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={versionScope === 'all'}
                    onChange={() => setVersionScope('all')}
                    className="w-4 h-4"
                  />
                  <span>כל הגרסאות ({versions.length})</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={versionScope === 'select'}
                    onChange={() => setVersionScope('select')}
                    className="w-4 h-4"
                  />
                  <span>בחר גרסאות...</span>
                </label>

                {versionScope === 'select' && (
                  <div className="pr-6 pt-1 space-y-1">
                    {versions.map((v) => (
                      <label key={v.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(v.id)}
                          onChange={() => toggleSelectedId(v.id)}
                          className="w-4 h-4"
                        />
                        <span>{v.name}</span>
                        {v.id === activeVersionId && (
                          <span className="text-xs text-blue-600">(פעילה)</span>
                        )}
                      </label>
                    ))}
                    {versions.length === 0 && (
                      <p className="text-xs text-gray-400">אין גרסאות זמינות</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleExportJson}
                disabled={exportDisabled}
                className="text-sm text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-400 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >⬇ JSON</button>
              <button
                onClick={handleExportCsv}
                disabled={exportDisabled}
                className="text-sm text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-400 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >⬇ CSV</button>
              <button
                onClick={handlePrint}
                className="text-sm text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-400 px-3 py-2 rounded-lg transition-colors font-medium"
              >🖨 הדפסה / PDF</button>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              JSON — לגיבוי וייבוא חזרה למערכת. CSV — פתיחה באקסל או Google Sheets.
              הדפסה — פותחת את חלון ההדפסה של הדפדפן ומאפשרת לשמור כ-PDF.
            </p>
          </div>
        )}

        {tab === 'import' && (
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-700 mb-2">בחר קובץ JSON שיוצא בעבר מהמערכת:</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChosen(file);
                }}
                className="text-xs text-gray-600 file:text-xs file:bg-blue-50 file:text-blue-700 file:border file:border-blue-200 file:rounded file:px-2 file:py-1 file:ml-2 file:cursor-pointer hover:file:bg-blue-100"
              />
              {importFileName && !importError && !importPreview && (
                <p className="text-xs text-gray-500 mt-2">טוען {importFileName}...</p>
              )}
            </div>

            {importError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-sm text-red-700 font-medium">שגיאה בייבוא</p>
                <p className="text-xs text-red-600 mt-0.5">{importError}</p>
              </div>
            )}

            {importPreview && importedPlanSummary && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-sm font-semibold text-gray-800 mb-1.5">תצוגה מקדימה</p>
                <ul className="text-xs text-gray-700 space-y-0.5">
                  <li>גרסה פעילה: {importedPlanSummary.activeName}</li>
                  <li>סה"כ גרסאות: {importedPlanSummary.versionCount}</li>
                  <li>מסלול: {importedPlanSummary.trackId ?? '—'}</li>
                  <li>מספר קורסים בגרסה הפעילה: {importedPlanSummary.courseCount}</li>
                </ul>
              </div>
            )}

            {localVersionsWillBeLost && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-sm text-amber-800 font-medium">שים לב</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  יש לך כרגע {versions.length} גרסאות מקומיות. הייבוא יחליף אותן ב-{importPreview?.versions.length ?? 0} גרסאות מהקובץ. מומלץ לייצא גיבוי לפני הייבוא.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-400 px-3 py-2 rounded-lg transition-colors"
              >ביטול</button>
              <button
                onClick={handleConfirmImport}
                disabled={!importPreview}
                className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
              >ייבא והחלף תוכנית</button>
            </div>
          </div>
        )}

        {tab === 'share' && (
          <div className="space-y-4">
            {!user && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-sm text-amber-800 font-medium">נדרשת התחברות</p>
                <p className="text-xs text-amber-700 mt-0.5 mb-2">
                  כדי ליצור קישור שיתוף, יש להתחבר עם חשבון Google.
                </p>
                <button
                  onClick={() => signInWithGoogle()}
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                >התחבר</button>
              </div>
            )}

            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">מי יכול לגשת לקישור</p>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={shareAccess === 'public'}
                    onChange={() => setShareAccess('public')}
                    className="mt-0.5 w-4 h-4"
                  />
                  <div>
                    <span>כולם עם הקישור</span>
                    <p className="text-xs text-gray-500">כל מי שמקבל את הקישור יוכל לגשת ללא התחברות.</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={shareAccess === 'restricted'}
                    onChange={() => setShareAccess('restricted')}
                    className="mt-0.5 w-4 h-4"
                  />
                  <div className="flex-1">
                    <span>אנשים ספציפיים</span>
                    <p className="text-xs text-gray-500">רק כתובות המייל שתזין יוכלו לגשת (לאחר התחברות).</p>
                  </div>
                </label>

                {shareAccess === 'restricted' && (
                  <div className="pr-6 pt-2">
                    <textarea
                      value={shareEmailsRaw}
                      onChange={(e) => setShareEmailsRaw(e.target.value)}
                      placeholder="name@example.com, friend@technion.ac.il"
                      rows={3}
                      dir="ltr"
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      ניתן להפריד בפסיקים, רווחים או שורות חדשות.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">רמת הרשאה</p>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={sharePermission === 'view'}
                    onChange={() => setSharePermission('view')}
                    className="mt-0.5 w-4 h-4"
                  />
                  <div>
                    <span>צפייה בלבד</span>
                    <p className="text-xs text-gray-500">המקבלים יוכלו לראות את התוכנית, ללא אפשרות לערוך.</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={sharePermission === 'edit'}
                    onChange={() => setSharePermission('edit')}
                    className="mt-0.5 w-4 h-4"
                  />
                  <div>
                    <span>צפייה ועריכה</span>
                    <p className="text-xs text-gray-500">המקבלים יוכלו לערוך את התוכנית המשותפת. מומלץ להם לפתוח עותק נפרד במתכנן שלהם כדי שהעריכה לא תתבצע על הגרסה המשותפת.</p>
                  </div>
                </label>
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shareIncludeGrades}
                onChange={(e) => setShareIncludeGrades(e.target.checked)}
                className="mt-0.5 w-4 h-4"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-800">כלול ציונים בעותק המשותף</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  ללא סימון — הציונים לא יישלחו עם הקישור.
                </p>
              </div>
            </label>

            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">תוקף הקישור</p>
              <select
                value={shareTtlMs === null ? '' : String(shareTtlMs)}
                onChange={(e) => setShareTtlMs(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 bg-white"
                dir="rtl"
              >
                <option value="">ללא הגבלה</option>
                <option value="86400000">יום אחד</option>
                <option value="259200000">3 ימים</option>
                <option value="604800000">שבוע</option>
                <option value="2592000000">חודש</option>
                <option value="10368000000">4 חודשים</option>
                <option value="31536000000">שנה</option>
              </select>
              {shareTtlMs !== null && (
                <p className="text-xs text-amber-700 mt-1.5">
                  הקישור יפוג ב-{new Date(Date.now() + shareTtlMs).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </p>
              )}
            </div>

            {shareError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-700">{shareError}</p>
              </div>
            )}

            {shareUrl ? (
              <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
                <p className="text-sm font-semibold text-emerald-800 mb-1">הקישור מוכן</p>
                <div className="flex gap-2 items-stretch">
                  <input
                    readOnly
                    value={shareUrl}
                    dir="ltr"
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 text-xs bg-white border border-emerald-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    onClick={handleCopyShareUrl}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                  >{shareCopied ? '✓ הועתק' : 'העתק'}</button>
                </div>
                <p className="text-xs text-emerald-700 mt-2">
                  שלח את הקישור הזה למי שתרצה לשתף איתו. ניתן ליצור קישור חדש בכל עת.
                </p>
                {lastSharedEmails.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <p className="text-xs text-emerald-800 mb-1.5">
                      שלח את הקישור במייל ל-{lastSharedEmails.length === 1 ? 'נמען' : `${lastSharedEmails.length} נמענים`} שהוזנו:
                    </p>
                    <button
                      onClick={handleSendShareEmail}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded transition-colors"
                    >✉ שלח מייל לנמענים</button>
                    <p className="text-xs text-emerald-700 mt-1.5">
                      הפעולה תפתח את לקוח המייל המקומי שלך עם הקישור והפרטים מוכנים לשליחה.
                    </p>
                  </div>
                )}
                <button
                  onClick={() => { setShareUrl(null); setShareCopied(false); }}
                  className="text-xs text-emerald-700 hover:text-emerald-900 underline mt-2"
                >צור קישור נוסף</button>
              </div>
            ) : (
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-400 px-3 py-2 rounded-lg transition-colors"
                >ביטול</button>
                <button
                  onClick={handleCreateShare}
                  disabled={!user || shareLoading}
                  className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
                >{shareLoading ? 'יוצר קישור...' : 'צור קישור'}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
