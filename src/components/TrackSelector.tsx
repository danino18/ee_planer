import type { TrackDefinition } from '../types';
import { usePlanStore } from '../store/planStore';

const TRACK_ICONS: Record<string, string> = {
  ee: '⚡',
  cs: '💻',
  ee_math: '📐',
  ee_physics: '🔬',
};

export function TrackSelector({ tracks }: { tracks: TrackDefinition[] }) {
  const setTrack = usePlanStore((s) => s.setTrack);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">מתכנן לימודים</h1>
          <p className="text-lg text-gray-600">הפקולטה להנדסת חשמל ומחשבים – הטכניון</p>
          <p className="text-sm text-gray-400 mt-1">תכנית לימודים 2025/2026</p>
        </div>
        <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">בחר מסלול לימודים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => setTrack(track.id)}
              className="bg-white rounded-2xl shadow hover:shadow-lg border-2 border-transparent hover:border-blue-400 transition-all p-7 text-right group"
            >
              <div className="flex items-start gap-4">
                <span className="text-4xl">{TRACK_ICONS[track.id] ?? '📚'}</span>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-700 mb-1">
                    {track.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed">{track.description}</p>
                  <div className="flex gap-3 text-sm flex-wrap">
                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                      {track.totalCreditsRequired} נ״ז
                    </span>
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                      7 סמסטרים
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
