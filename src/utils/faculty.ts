// Deterministic faculty color styles
const STYLES = {
  math:  { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
  ee:    { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700' },
  human: { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' },
  phys:  { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
  cs:    { dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
};

// Fallback palette for unrecognized faculties
const FALLBACK_PALETTE = [
  { dot: 'bg-teal-500',   badge: 'bg-teal-100 text-teal-700' },
  { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700' },
  { dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700' },
  { dot: 'bg-pink-500',   badge: 'bg-pink-100 text-pink-700' },
  { dot: 'bg-cyan-500',   badge: 'bg-cyan-100 text-cyan-700' },
];

function hashFaculty(faculty: string): number {
  let h = 0;
  for (const c of faculty) h = (h * 31 + c.charCodeAt(0)) % FALLBACK_PALETTE.length;
  return Math.abs(h);
}

export function getFacultyStyle(faculty: string, courseId?: string) {
  // Course ID prefix takes priority (most reliable)
  if (courseId) {
    const prefix = courseId.substring(0, 3);
    if (prefix === '004') return STYLES.ee;
    if (prefix === '010') return STYLES.math;
    if (prefix === '011') return STYLES.phys;
    if (prefix === '023') return STYLES.cs;
    if (prefix === '032') return STYLES.human;
  }
  // Faculty keyword matching — check "חשמל" before "מחשב" to avoid false match on "חשמל ומחשבים"
  if (faculty.includes('חשמל')) return STYLES.ee;
  if (faculty.includes('מתמטיקה')) return STYLES.math;
  if (faculty.includes('פיזיקה') || faculty.includes('פיסיקה')) return STYLES.phys;
  if (faculty.includes('מחשב')) return STYLES.cs;
  if (faculty.includes('הומוניסטי') || faculty.includes('חינוך')) return STYLES.human;

  return FALLBACK_PALETTE[hashFaculty(faculty)];
}

// Strip common Hebrew prefixes to get a short display name
export function getFacultyShortName(faculty: string): string {
  return faculty
    .replace(/^הפקולטה\s+(ל|של)?\s*/i, '')
    .replace(/^הפקולטה\s+/i, '')
    .replace(/^מחלקת\s+/i, '')
    .split(' ')
    .slice(0, 2)
    .join(' ');
}
