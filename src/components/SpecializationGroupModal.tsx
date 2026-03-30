import { createPortal } from 'react-dom';
import type { SpecializationGroup, SapCourse } from '../types';
import { usePlanStore } from '../store/planStore';

interface Props {
  group: SpecializationGroup;
  courses: Map<string, SapCourse>;
  onClose: () => void;
}

export function SpecializationGroupModal({ group, courses, onClose }: Props) {
  const { favorites, toggleFavorite, semesters, completedCourses, addCourseToSemester } = usePlanStore();
  const allPlaced = new Set([...completedCourses, ...Object.values(semesters).flat()]);

  const renderCourse = (id: string) => {
    const course = courses.get(id);
    const inPlan = allPlaced.has(id);
    const isFav = favorites.includes(id);
    return (
      <div key={id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
        <div className="flex-1 min-w-0 ml-2">
          <p className="text-sm text-gray-800 truncate">{course?.name ?? id}</p>
          <p className="text-xs text-gray-400">{id} · {course?.credits ?? '?'} נ״ז</p>
        </div>
        <div className="flex items-center gap-2">
          {inPlan && <span className="text-xs text-green-600 font-bold">✓</span>}
          <button
            onClick={() => toggleFavorite(id)}
            className={`text-lg leading-none ${isFav ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
            title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          >
            {isFav ? '★' : '☆'}
          </button>
          {!inPlan && (
            <button
              onClick={() => addCourseToSemester(id, 0)}
              className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-1.5 py-0.5 rounded transition-colors"
              title="הוסף ל'לא משובץ'"
            >
              ＋
            </button>
          )}
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="font-bold text-gray-900">{group.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">נדרשים {group.minCoursesToComplete} קורסים</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {group.mandatoryCourses.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">קורסי חובה</p>
              {group.mandatoryCourses.map(renderCourse)}
            </>
          )}
          {group.mandatoryOptions && group.mandatoryOptions.length > 0 && (
            <div className="mt-3 mb-1 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 mb-2">
                ⚠️ יש לבחור לפחות אחד מהקורסים הבאים:
              </p>
              {group.mandatoryOptions.map((opts, i) => (
                <div key={i}>
                  {opts.map(renderCourse)}
                </div>
              ))}
            </div>
          )}
          {group.electiveCourses.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-500 mt-4 mb-2 uppercase tracking-wide">
                קורסי בחירה
              </p>
              {group.electiveCourses.map(renderCourse)}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
