import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SapCourse, TrackDefinition, TrackSpecializationCatalog } from '../types';
import { usePlanStore } from '../store/planStore';
import { useChainRecommendations } from '../hooks/usePlan';

interface Props {
  catalog: TrackSpecializationCatalog;
  courses: Map<string, SapCourse>;
  trackDef: TrackDefinition | null;
}

export function ChainRecommendations({ catalog, courses, trackDef }: Props) {
  const {
    toggleSpecialization,
    selectedSpecializations,
    semesters,
    completedCourses,
  } = usePlanStore(useShallow((state) => ({
    toggleSpecialization: state.toggleSpecialization,
    selectedSpecializations: state.selectedSpecializations,
    semesters: state.semesters,
    completedCourses: state.completedCourses,
  })));
  const allPlaced = new Set([...completedCourses, ...Object.values(semesters).flat()]);
  const recommendations = useChainRecommendations(courses, catalog, trackDef);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  if (catalog.interactionDisabled) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-bold text-gray-900 mb-1">נ¯ ׳©׳¨׳©׳¨׳׳•׳× ׳׳•׳׳׳¦׳•׳×</h2>
        <p className="text-xs text-amber-700">המלצות התמחות מושבתות עד שתוקנו קבצי ההתמחויות למסלול זה.</p>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-bold text-gray-900 mb-1">🎯 שרשראות מומלצות</h2>
        <p className="text-xs text-gray-400">שבץ קורסים בתוכנית כדי לקבל המלצות</p>
      </div>
    );
  }

  const allAdded = recommendations.every((r) => selectedSpecializations.includes(r.group.id));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-base font-bold text-gray-900 mb-1">🎯 שרשראות מומלצות עבורך</h2>
      {allAdded ? (
        <p className="text-xs text-green-600 mb-2">✓ כל ההמלצות נבחרו</p>
      ) : (
        <p className="text-xs text-gray-400 mb-3">על פי הקורסים בתוכניתך</p>
      )}
      <div className="flex flex-col gap-2">
        {recommendations.map(({ group, matchingCourses }) => {
          const isSelected = selectedSpecializations.includes(group.id);
          return (
            <div
              key={group.id}
              className={`rounded-lg border p-2.5 ${isSelected ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                  {isSelected && <span className="text-xs text-green-600 shrink-0">✓</span>}
                </span>
                {/* Chain name with hover tooltip */}
                <div
                  className="relative flex-1 text-right"
                  onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                >
                  <span className="text-xs font-semibold text-gray-800 cursor-pointer">{group.name}</span>
                  {expandedGroup === group.id && (
                    <div className="absolute z-50 top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-64 max-w-[calc(100vw-2rem)] text-right">
                      <p className="text-xs font-bold text-gray-700 mb-1.5">{group.name}</p>
                      {group.mandatoryCourses.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-blue-700 mb-1">חובה:</p>
                          <ul className="space-y-0.5">
                            {group.mandatoryCourses.map((id) => (
                              <li key={id} className={`text-xs flex items-center gap-1 ${allPlaced.has(id) ? 'text-green-700' : 'text-gray-500'}`}>
                                <span>{allPlaced.has(id) ? '✓' : '○'}</span>
                                <span>{courses.get(id)?.name ?? id}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">בחירה ({group.electiveCourses.length}):</p>
                        <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                          {group.electiveCourses.map((id) => (
                            <li key={id} className={`text-xs flex items-center gap-1 ${allPlaced.has(id) ? 'text-green-700' : 'text-gray-400'}`}>
                              <span>{allPlaced.has(id) ? '✓' : '○'}</span>
                              <span>{courses.get(id)?.name ?? id}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5 border-t pt-1.5">נדרש: {group.minCoursesToComplete} קורסים</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                {matchingCourses.length} קורסים מתוכניתך מתאימים
              </p>
              {matchingCourses.length > 0 && (
                <ul className="text-xs text-gray-400 mb-2 space-y-0.5">
                  {matchingCourses.slice(0, 3).map((name, i) => (
                    <li key={i} className="truncate">• {name}</li>
                  ))}
                </ul>
              )}
              {!isSelected && (
                <button
                  onClick={() => toggleSpecialization(group.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-2 py-0.5 rounded-lg transition-colors w-full"
                >
                  הוסף לתוכנית
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
