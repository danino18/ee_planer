import type { SapCourse } from '../types';

export function getTeachingSemesterBadge(
  teachingSemester?: SapCourse['teachingSemester'],
): { emoji: string; title: string } | null {
  if (teachingSemester === 'winter') {
    return { emoji: '❄️', title: 'חורף בלבד' };
  }

  if (teachingSemester === 'spring') {
    return { emoji: '🌸', title: 'אביב בלבד' };
  }

  return null;
}
