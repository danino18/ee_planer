import { useState } from 'react';
import type { SpecializationGroup, SapCourse } from '../types';
import { usePlanStore } from '../store/planStore';
import { SpecializationGroupModal } from './SpecializationGroupModal';

interface Props {
  groups: SpecializationGroup[];
  courses: Map<string, SapCourse>;
}

export function SpecializationPanel({ groups, courses }: Props) {
  const { selectedSpecializations, semesters, completedCourses, toggleSpecialization } = usePlanStore();
  const allPlaced = new Set([...completedCourses, ...Object.values(semesters).flat()]);
  const [openGroup, setOpenGroup] = useState<SpecializationGroup | null>(null);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-bold text-gray-900 mb-1">קבוצות התמחות</h2>
        <p className="text-xs text-gray-400 mb-3">לחץ לפתיחת רשימת קורסים</p>
        <div className="flex flex-col gap-1.5">
          {groups.map((group) => {
            const isSelected = selectedSpecializations.includes(group.id);
            const all = [...group.mandatoryCourses, ...group.electiveCourses];
            const done = all.filter((id) => allPlaced.has(id)).length;
            const pct = Math.min(100, (done / group.minCoursesToComplete) * 100);
            const complete = done >= group.minCoursesToComplete;
            return (
              <button
                key={group.id}
                onClick={() => setOpenGroup(group)}
                className={`text-right p-2.5 rounded-lg border-2 transition-all ${
                  isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); toggleSpecialization(group.id); }}
                      className={`text-xs leading-none w-4 h-4 flex items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 text-transparent hover:border-blue-400'
                      }`}
                      title={isSelected ? 'בטל בחירה' : 'בחר קבוצה'}
                    >
                      ✓
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-800">{group.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {done}/{group.minCoursesToComplete}{complete ? ' ✓' : ''}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${complete ? 'bg-green-500' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {openGroup && (
        <SpecializationGroupModal
          group={openGroup}
          courses={courses}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </>
  );
}
