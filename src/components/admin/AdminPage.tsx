import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { fetchAllTrackMeta, fetchCatalogYearRules, clearDegreeRulesCache } from '../../services/degreeRulesService';
import { fetchCourses } from '../../services/sapApi';
import type { FirestoreTrackMeta } from '../../types/firestoreRules';
import type { SapCourse, TrackId } from '../../types';
import { TrackRulesEditor } from './TrackRulesEditor';
import { SpecializationsEditor } from './SpecializationsEditor';
import { GlobalSettingsEditor } from './GlobalSettingsEditor';

type SidebarItem = TrackId | '__global__';
type AdminTab = 'rules' | 'specializations';

export function AdminPage() {
  const [trackMetas, setTrackMetas] = useState<FirestoreTrackMeta[]>([]);
  const [courses, setCourses] = useState<Map<string, SapCourse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('base');
  const [activeTab, setActiveTab] = useState<AdminTab>('rules');
  const [addingYear, setAddingYear] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');
  const [copyFromYear, setCopyFromYear] = useState('base');
  const [addingYearBusy, setAddingYearBusy] = useState(false);
  const [addYearError, setAddYearError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAllTrackMeta(), fetchCourses()])
      .then(([metas, loadedCourses]) => {
        const sorted = [...metas].sort((a, b) => a.id.localeCompare(b.id));
        setTrackMetas(sorted);
        if (sorted.length > 0) setSelectedItem(sorted[0].id);
        setCourses(loadedCourses);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedTrack = selectedItem === '__global__' ? null : selectedItem as TrackId | null;
  const currentMeta = trackMetas.find((m) => m.id === selectedTrack);
  const yearOptions: string[] = currentMeta
    ? ['base', ...currentMeta.availableYears.map(String)]
    : ['base'];

  function handleTrackChange(id: TrackId) {
    setSelectedItem(id);
    setSelectedYear('base');
    setAddingYear(false);
    setAddYearError(null);
  }

  async function handleAddYear() {
    if (!selectedTrack) return;
    const yearNum = parseInt(newYearInput.trim());
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      setAddYearError('שנה לא תקינה');
      return;
    }
    const meta = trackMetas.find((m) => m.id === selectedTrack);
    if (meta?.availableYears.includes(yearNum)) {
      setAddYearError('שנה זו כבר קיימת');
      return;
    }

    setAddingYearBusy(true);
    setAddYearError(null);
    try {
      const sourceYear = copyFromYear === 'base' ? null : parseInt(copyFromYear);
      const sourceRules = await fetchCatalogYearRules(selectedTrack, sourceYear);
      if (!sourceRules) { setAddYearError('לא נמצאו נתוני מקור'); return; }

      // Write new catalog year doc
      await setDoc(
        doc(db, 'degreeRules', selectedTrack, 'catalogYears', String(yearNum)),
        JSON.parse(JSON.stringify(sourceRules)),
      );

      // Update track meta availableYears
      const currentYears = meta?.availableYears ?? [];
      const updatedYears = [...new Set([...currentYears, yearNum])].sort((a, b) => b - a);
      await setDoc(doc(db, 'degreeRules', selectedTrack), { ...meta, availableYears: updatedYears });

      clearDegreeRulesCache();
      setTrackMetas((prev) =>
        prev.map((m) => m.id === selectedTrack ? { ...m, availableYears: updatedYears } : m),
      );
      setSelectedYear(String(yearNum));
      setAddingYear(false);
      setNewYearInput('');
    } catch (e) {
      setAddYearError('שגיאה: ' + String(e));
    } finally {
      setAddingYearBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (trackMetas.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow max-w-md text-center">
          <p className="text-gray-700 font-medium mb-2">אין נתונים ב-Firestore</p>
          <p className="text-gray-500 text-sm">הרץ <code className="bg-gray-100 px-1 rounded">npm run seed:degree-rules</code> כדי לזרוע את הנתונים הראשוניים.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-800">ניהול דרישות לימודים</span>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
        </div>
        <a href="#" className="text-sm text-gray-500 hover:text-gray-700">← חזרה לאפליקציה</a>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 bg-white border-l border-gray-200 flex flex-col">
          {/* Global settings entry */}
          <div className="border-b border-gray-100">
            <button
              onClick={() => setSelectedItem('__global__')}
              className={`w-full text-right px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                selectedItem === '__global__' ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>⚙</span> הגדרות מערכת
            </button>
          </div>

          <p className="text-xs text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1.5 font-medium">מסלולים</p>
          {trackMetas.map((meta) => (
            <button
              key={meta.id}
              onClick={() => handleTrackChange(meta.id)}
              className={`text-right px-3 py-2.5 text-sm border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                selectedItem === meta.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              {meta.name}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {selectedItem === '__global__' && <GlobalSettingsEditor />}

          {selectedTrack && (
            <>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-sm text-gray-600">שנת קטלוג:</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y === 'base' ? 'ברירת מחדל (base)' : y}</option>
                    ))}
                  </select>

                  {!addingYear ? (
                    <button
                      onClick={() => { setAddingYear(true); setCopyFromYear(selectedYear); setNewYearInput(''); setAddYearError(null); }}
                      className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-2 py-1 bg-white flex items-center gap-1"
                      title="הוסף שנת קטלוג חדשה"
                    >
                      <span className="text-base leading-none">+</span> שנה חדשה
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-xl px-3 py-1.5 shadow-sm flex-wrap">
                      <span className="text-xs text-gray-500">שנה:</span>
                      <input
                        type="number"
                        value={newYearInput}
                        onChange={(e) => setNewYearInput(e.target.value)}
                        placeholder="2025"
                        className="w-20 border border-gray-200 rounded px-2 py-0.5 text-sm text-center"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddYear(); if (e.key === 'Escape') setAddingYear(false); }}
                      />
                      <span className="text-xs text-gray-500">העתק מ:</span>
                      <select
                        value={copyFromYear}
                        onChange={(e) => setCopyFromYear(e.target.value)}
                        className="border border-gray-200 rounded px-2 py-0.5 text-sm bg-white"
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>{y === 'base' ? 'ברירת מחדל' : y}</option>
                        ))}
                      </select>
                      {addYearError && <span className="text-xs text-red-500">{addYearError}</span>}
                      <button
                        onClick={handleAddYear}
                        disabled={addingYearBusy || !newYearInput}
                        className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {addingYearBusy ? '...' : 'צור'}
                      </button>
                      <button
                        onClick={() => setAddingYear(false)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        ביטול
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setActiveTab('rules')}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      activeTab === 'rules' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    דרישות
                  </button>
                  <button
                    onClick={() => setActiveTab('specializations')}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      activeTab === 'specializations' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    קבוצות התמחות
                  </button>
                </div>
              </div>

              {activeTab === 'rules' && (
                <TrackRulesEditor key={`${selectedTrack}:${selectedYear}`} trackId={selectedTrack} year={selectedYear} courses={courses} />
              )}
              {activeTab === 'specializations' && (
                <SpecializationsEditor key={selectedTrack} trackId={selectedTrack} courses={courses} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
