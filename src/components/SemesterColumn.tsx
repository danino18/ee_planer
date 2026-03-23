import { useDroppable } from '@dnd-kit/core';
import { CourseCard } from './CourseCard';
import type { SapCourse } from '../types';

const SEM_LABELS = [
  'לא משובץ',
  'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳',
  'ח׳', 'ט׳', 'י׳', 'יא׳', 'יב׳', 'יג׳', 'יד׳', 'טו׳', 'טז׳',
];

interface Props {
  semester: number;
  courseIds: string[];
  courses: Map<string, SapCourse>;
  mandatoryCourseIds: Set<string>;
  prereqStatus: Map<string, string[][]>;
  completedCourses: Set<string>;
}

export function SemesterColumn({ semester, courseIds, courses, mandatoryCourseIds, prereqStatus, completedCourses }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `semester-${semester}` });
  const totalCredits = courseIds.reduce((s, id) => s + (courses.get(id)?.credits ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border-2 min-h-40 transition-colors
        ${isOver ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-gray-50/50'}`}
    >
      <div className="px-3 py-2 bg-white rounded-t-xl border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-800 text-sm">
            {semester === 0 ? 'לא משובץ' : `סמסטר ${SEM_LABELS[semester]}`}
          </span>
          {semester > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {totalCredits.toFixed(1)} נ״ז
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 p-2 flex-1 overflow-y-auto max-h-64">
        {courseIds.map((id) => {
          const course = courses.get(id);
          if (!course) return null;
          const missingPrereqGroups = prereqStatus.get(id) ?? [];
          return (
            <CourseCard
              key={id}
              course={course}
              courses={courses}
              isMandatory={mandatoryCourseIds.has(id)}
              hasPrereqWarning={missingPrereqGroups.length > 0}
              missingPrereqGroups={missingPrereqGroups}
              isCompleted={completedCourses.has(id)}
              semester={semester}
            />
          );
        })}
        {courseIds.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6 italic">
            {semester === 0 ? 'כל הקורסים משובצים' : 'גרור קורסים לכאן'}
          </p>
        )}
      </div>
    </div>
  );
}
