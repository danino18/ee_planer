// Fixed color palette for faculty tags — all class names are literal strings so Tailwind includes them
const PALETTE = [
  { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700' },
  { dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
  { dot: 'bg-teal-500',   badge: 'bg-teal-100 text-teal-700' },
  { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
  { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
  { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700' },
  { dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700' },
  { dot: 'bg-pink-500',   badge: 'bg-pink-100 text-pink-700' },
  { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' },
  { dot: 'bg-cyan-500',   badge: 'bg-cyan-100 text-cyan-700' },
];

function hashFaculty(faculty: string): number {
  let h = 0;
  for (const c of faculty) h = (h * 31 + c.charCodeAt(0)) % PALETTE.length;
  return Math.abs(h);
}

export function getFacultyStyle(faculty: string) {
  return PALETTE[hashFaculty(faculty)];
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
