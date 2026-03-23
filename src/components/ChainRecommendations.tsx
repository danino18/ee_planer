import type { SapCourse, SpecializationGroup } from '../types';
import { usePlanStore } from '../store/planStore';
import { useChainRecommendations } from '../hooks/usePlan';

interface Props {
  groups: SpecializationGroup[];
  courses: Map<string, SapCourse>;
}

export function ChainRecommendations({ groups, courses }: Props) {
  const { toggleSpecialization, selectedSpecializations } = usePlanStore();
  const recommendations = useChainRecommendations(courses, groups);

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
                <span className="text-xs font-semibold text-gray-800">{group.name}</span>
                {isSelected && <span className="text-xs text-green-600 shrink-0">✓</span>}
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
