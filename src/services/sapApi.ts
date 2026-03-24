import type { SapCourse } from '../types';

const BASE_URL = 'https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages';

interface SapSemester {
  year: number;
  semester: number;
  start: string;
  end: string;
}

interface RawSapCourse {
  general: Record<string, string>;
  schedule: Array<Record<string, string>>;
}

let courseCache: Map<string, SapCourse> | null = null;

// Split on " או " to get OR-alternatives; within each alternative extract all 8-digit IDs (AND-requirements).
// Example: "(A ו-B) או (C ו-D)" → [[A,B],[C,D]]
function parsePrerequisites(prereqStr?: string): string[][] {
  if (!prereqStr) return [];
  const orGroups = prereqStr.split(/\s+או\s+/);
  return orGroups
    .map(group => (group.match(/\d{8}/g) ?? []))
    .filter(group => group.length > 0);
}

export async function fetchCourses(): Promise<Map<string, SapCourse>> {
  if (courseCache) return courseCache;

  const semRes = await fetch(`${BASE_URL}/last_semesters.json`);
  const semesters: SapSemester[] = await semRes.json();

  // Fetch ALL listed semesters in parallel for full course name coverage
  const maps = await Promise.all(
    semesters.map(async (sem) => {
      try {
        const url = `${BASE_URL}/courses_${sem.year}_${sem.semester}.json`;
        const res = await fetch(url);
        const rawData: Record<string, RawSapCourse> = await res.json();
        const m = new Map<string, SapCourse>();
        for (const [, course] of Object.entries(rawData)) {
          const g = course.general;
          const id = g['מספר מקצוע'];
          if (!id) continue;
          const credits = parseFloat(g['נקודות'] ?? '0');
          m.set(id, {
            id,
            name: g['שם מקצוע'] ?? id,
            credits: isNaN(credits) ? 0 : credits,
            prerequisites: parsePrerequisites(g['מקצועות קדם']),
            examMoed1: g['מועד א'],
            examMoed2: g['מועד ב'],
            faculty: g['פקולטה'] ?? '',
            syllabus: g['סילבוס'],
          });
        }
        return m;
      } catch {
        return new Map<string, SapCourse>(); // skip failed semesters gracefully
      }
    })
  );

  // Merge: oldest first so newest semester (index 0) wins on conflict
  const merged = new Map<string, SapCourse>();
  for (const m of [...maps].reverse()) {
    for (const [id, course] of m) {
      merged.set(id, course);
    }
  }

  // Fallback entries for legacy courses no longer offered in recent semesters
  const LEGACY_COURSES: Record<string, { name: string; credits: number }> = {
    '01130013': { name: 'פיזיקה 1מ', credits: 4 },
    '01040036': { name: 'משוואות דיפרנציליות רגילות', credits: 3.5 },
    '01130014': { name: 'פיזיקה 2ממ', credits: 4 },
    // קורסים שהוצעו בסמסטרים ישנים (לא ב-last_semesters.json)
    '00460746': { name: 'אלגוריתמים ויישומים בראייה ממוחשבת', credits: 3 },
    '02360309': { name: 'מבוא לתורת הצפינה', credits: 3 },
    '00460216': { name: 'מיקרוגלים', credits: 3 },
    // קורסים שאינם ב-SAP הנוכחי
    '00460853': { name: 'ארכיטקטורות מחשבים מתקדמות', credits: 3 },
    '00460196': { name: 'בקרה לא לינארית', credits: 3 },
    '00460129': { name: 'פיסיקה של מצב מוצק', credits: 3.5 },
    '00460230': { name: 'התקנים אלקטרוניים מתקדמים', credits: 3 },
    '00460345': { name: 'גרפיקה ממוחשבת', credits: 3 },
    '00460743': { name: 'עיבוד אותות מרחבי', credits: 3 },
    '00460204': { name: 'תקשורת אנלוגית', credits: 3 },
    '00460242': { name: 'פיסיקה סטטיסטית להנדסת חשמל', credits: 3 },
    '00460001': { name: 'הנדסת מערכות תוכנה מבוזרות', credits: 3 },
    '03940900': { name: 'חינוך גופני', credits: 1 },
    '03940901': { name: 'חינוך גופני', credits: 1 },
    '03940902': { name: 'נבחרות ספורט', credits: 1.5 },
    '03940800': { name: 'ספורט נבחרות', credits: 1.5 },
  };
  for (const [id, info] of Object.entries(LEGACY_COURSES)) {
    if (!merged.has(id)) {
      merged.set(id, { id, name: info.name, credits: info.credits, prerequisites: [], faculty: '' });
    }
  }

  // Remove self-referencing prerequisites (e.g. פיזיקה 1מ listing itself as prereq)
  for (const [id, course] of merged) {
    course.prerequisites = course.prerequisites
      .map(group => group.filter(prereqId => prereqId !== id))
      .filter(group => group.length > 0);
  }

  // Fix: 01140071 (פיסיקה 1מ, new ID) lists 01130013 (פיזיקה 1מ, old ID) as prereq — same course
  const physics1m = merged.get('01140071');
  if (physics1m) {
    physics1m.prerequisites = physics1m.prerequisites
      .map(group => group.filter(id => id !== '01130013'))
      .filter(group => group.length > 0);
  }

  // Force correct credits for sport courses (SAP data may have wrong values)
  const SPORT_OVERRIDES: Record<string, number> = {
    '03940900': 1,
    '03940901': 1,
    '03940902': 1.5,
    '03940800': 1.5,
  };
  for (const [id, credits] of Object.entries(SPORT_OVERRIDES)) {
    const course = merged.get(id);
    if (course) course.credits = credits;
  }

  courseCache = merged;
  return merged;
}
