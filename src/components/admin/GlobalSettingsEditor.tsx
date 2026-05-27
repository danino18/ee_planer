import { useEffect, useState } from 'react';
import { fetchGlobalCourseSettings, saveGlobalCourseSettings } from '../../services/degreeRulesService';
import { applyGlobalCourseSettings } from '../../data/generalRequirements/courseClassification';
import { DEFAULT_GLOBAL_COURSE_SETTINGS } from '../../types/firestoreRules';
import type { GlobalCourseSettings } from '../../types/firestoreRules';

const KNOWN_FACULTY_AREAS = [
  { key: 'ee',         label: 'הנדסת חשמל' },
  { key: 'cs',         label: 'מדמ"ח / מחשבים' },
  { key: 'math',       label: 'מתמטיקה' },
  { key: 'physics',    label: 'פיזיקה' },
  { key: 'humanities', label: 'הומניסטי' },
];

export function GlobalSettingsEditor() {
  const [settings, setSettings] = useState<GlobalCourseSettings>(DEFAULT_GLOBAL_COURSE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGlobalCourseSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveGlobalCourseSettings(settings);
      applyGlobalCourseSettings(settings);
      setSaved(true);
    } catch (e) {
      setError('שגיאה בשמירה: ' + String(e));
    } finally {
      setSaving(false);
    }
  }

  function updateRange(idx: number, field: 'start' | 'end', value: string) {
    const ranges = settings.sport.ranges.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    setSettings({ ...settings, sport: { ...settings.sport, ranges } });
    setSaved(false);
  }

  function addRange() {
    setSettings({ ...settings, sport: { ...settings.sport, ranges: [...settings.sport.ranges, { start: '', end: '' }] } });
    setSaved(false);
  }

  function removeRange(idx: number) {
    setSettings({ ...settings, sport: { ...settings.sport, ranges: settings.sport.ranges.filter((_, i) => i !== idx) } });
    setSaved(false);
  }

  function updatePrefixes(areaKey: string, raw: string) {
    const prefixes = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    setSettings({
      ...settings,
      facultyAreaPrefixes: { ...settings.facultyAreaPrefixes, [areaKey]: prefixes },
    });
    setSaved(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Save bar */}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-green-600 text-sm">נשמר ✓</span>}
        {error && <span className="text-red-600 text-sm">{error}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>

      {/* Sport settings */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">קורסי ספורט</h2>
        <p className="text-xs text-gray-500">
          קורס מזוהה כספורט אם מספרו נופל בתוך אחד מהטווחים, או תואם לאחד מהתבניות הנוספות.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">טווחי מספרי קורסים</p>
          {settings.sport.ranges.map((range, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6 text-left">{idx + 1}.</span>
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 flex-1">
                <label className="text-xs text-gray-500">מ-</label>
                <input
                  value={range.start}
                  onChange={(e) => updateRange(idx, 'start', e.target.value)}
                  className="w-28 text-sm font-mono bg-transparent outline-none"
                  placeholder="03940800"
                  dir="ltr"
                />
                <span className="text-gray-300 mx-1">–</span>
                <label className="text-xs text-gray-500">עד-</label>
                <input
                  value={range.end}
                  onChange={(e) => updateRange(idx, 'end', e.target.value)}
                  className="w-28 text-sm font-mono bg-transparent outline-none"
                  placeholder="03940820"
                  dir="ltr"
                />
              </div>
              <button
                onClick={() => removeRange(idx)}
                disabled={settings.sport.ranges.length <= 1}
                className="text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addRange}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span className="text-lg leading-none">+</span> הוסף טווח
          </button>
        </div>

      </section>

      {/* Faculty area prefixes */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">קידומות קורסים לפי תחום פקולטה</h2>
        <p className="text-xs text-gray-500">
          קורס ישויך לתחום אם מספרו מתחיל באחת מהקידומות. ניתן להזין מספר קידומות מופרדות בפסיק.
        </p>
        <div className="space-y-3">
          {KNOWN_FACULTY_AREAS.map(({ key, label }) => {
            const prefixes = settings.facultyAreaPrefixes[key] ?? [];
            return (
              <div key={key} className="flex items-center gap-3">
                <label className="text-sm text-gray-700 w-32 shrink-0">{label}</label>
                <input
                  dir="ltr"
                  value={prefixes.join(', ')}
                  onChange={(e) => updatePrefixes(key, e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono bg-gray-50"
                  placeholder="004"
                />
                <span className="text-xs text-gray-400 shrink-0">
                  {prefixes.length > 0 ? prefixes.map((p) => `${p}...`).join(', ') : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
