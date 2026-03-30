import { useState } from 'react';
import type { SpecializationGroup, SapCourse } from '../types';
import { usePlanStore } from '../store/planStore';
import { SpecializationGroupModal } from './SpecializationGroupModal';

interface Props {
  groups: SpecializationGroup[];
  courses: Map<string, SapCourse>;
}

export function SpecializationPanel({ groups, courses }: Props) {
  const {
    selectedSpecializations, semesters, completedCourses,
    toggleSpecialization, doubleSpecializations, toggleDoubleSpecialization,
  } = usePlanStore();
  const allPlaced = new Set([...completedCourses, ...Object.values(semesters).flat()]);
  const [openGroup, setOpenGroup] = useState<SpecializationGroup | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const doubles = doubleSpecializations ?? [];

  function handleOpenGroup(group: SpecializationGroup) {
    setHoveredGroup(null); // close tooltip before opening modal
    setOpenGroup(group);
  }

  function handleDoubleClick(e: React.MouseEvent, group: SpecializationGroup) {
    e.stopPropagation();
    const isSelected = selectedSpecializations.includes(group.id);
    const isDouble = doubles.includes(group.id);
    if (!isSelected) {
      // select the group first
      toggleSpecialization(group.id);
      // if not yet double, mark as double; if already double (edge case), leave it
      if (!isDouble) toggleDoubleSpecialization(group.id);
    } else {
      // already selected — just toggle double
      toggleDoubleSpecialization(group.id);
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-bold text-gray-900 mb-1">קבוצות התמחות</h2>
        <p className="text-xs text-gray-400 mb-3">לחץ לפתיחת רשימת קורסים</p>
        <div className="flex flex-col gap-1.5">
          {groups.map((group) => {
            const isSelected = selectedSpecializations.includes(group.id);
            const isDouble = doubles.includes(group.id);
            const effectiveMin = (isDouble && group.doubleMinCoursesToComplete)
              ? group.doubleMinCoursesToComplete
              : group.minCoursesToComplete;
            const all = [...group.mandatoryCourses, ...group.electiveCourses];
            const done = all.filter((id) => allPlaced.has(id)).length;
            const allMandatoryDone = group.mandatoryCourses.length === 0 ||
              group.mandatoryCourses.every((id) => allPlaced.has(id));
            const mandatoryOptionsDone = !group.mandatoryOptions ||
              group.mandatoryOptions.every((opts) => opts.some((id) => allPlaced.has(id)));
            const complete = allMandatoryDone && mandatoryOptionsDone && done >= effectiveMin;
            const pct = Math.min(100, (done / effectiveMin) * 100);

            return (
              <div
                key={group.id}
                onClick={() => handleOpenGroup(group)}
                className={`text-right p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                  isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1">
                    {/* Checkbox */}
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
                    {/* Double toggle — always clickable for canBeDouble groups */}
                    {group.canBeDouble && (
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleDoubleClick(e, group)}
                        className={`text-xs leading-none px-1.5 py-0.5 rounded border transition-colors ${
                          isDouble
                            ? 'bg-purple-500 border-purple-500 text-white'
                            : 'border-gray-300 text-gray-400 hover:border-purple-400 hover:text-purple-500'
                        }`}
                        title={isDouble ? 'בטל התמחות כפולה' : 'הגדר כהתמחות כפולה'}
                      >
                        כ׳
                      </button>
                    )}
                  </div>
                  {/* Chain name with hover tooltip */}
                  <div
                    className="relative flex items-center gap-1.5"
                    onMouseEnter={() => setHoveredGroup(group.id)}
                    onMouseLeave={() => setHoveredGroup(null)}
                  >
                    <span className="text-xs font-semibold text-gray-800">{group.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {done}/{effectiveMin}{complete ? ' ✓' : ''}
                    </span>
                    {isDouble && <span className="text-xs bg-purple-100 text-purple-600 px-1 rounded font-medium">כפולה</span>}
                    {/* Hover tooltip — z-[60] so it's above panel content but below modals */}
                    {hoveredGroup === group.id && !openGroup && (
                      <div
                        className="absolute z-[60] top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-64 text-right"
                        onMouseEnter={() => setHoveredGroup(group.id)}
                        onMouseLeave={() => setHoveredGroup(null)}
                      >
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
                        {group.mandatoryOptions && group.mandatoryOptions.map((opts, i) => (
                          <div key={i} className="mb-2">
                            <p className="text-xs font-semibold text-orange-600 mb-1">
                              חובה — לפחות אחד{group.mandatoryOptions!.length > 1 ? ` (קבוצה ${i + 1})` : ''}:
                            </p>
                            <ul className="space-y-0.5">
                              {opts.map((id) => (
                                <li key={id} className={`text-xs flex items-center gap-1 ${allPlaced.has(id) ? 'text-green-700' : 'text-orange-500'}`}>
                                  <span>{allPlaced.has(id) ? '✓' : '◇'}</span>
                                  <span>{courses.get(id)?.name ?? id}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1">בחירה ({group.electiveCourses.length} קורסים):</p>
                          <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                            {group.electiveCourses.map((id) => (
                              <li key={id} className={`text-xs flex items-center gap-1 ${allPlaced.has(id) ? 'text-green-700' : 'text-gray-400'}`}>
                                <span>{allPlaced.has(id) ? '✓' : '○'}</span>
                                <span>{courses.get(id)?.name ?? id}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5 border-t pt-1.5">
                          נדרש: {effectiveMin} קורסים
                          {group.canBeDouble && group.doubleMinCoursesToComplete && ` | כפולה: ${group.doubleMinCoursesToComplete}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${complete ? (isDouble ? 'bg-purple-500' : 'bg-green-500') : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
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
