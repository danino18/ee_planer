export interface EntrepreneurshipCourse {
  id: string | null;  // null = ID not yet known, course cannot be auto-matched
  name: string;
  credits: number;
  mandatory: boolean;
}

export const ENTREPRENEURSHIP_COURSES: EntrepreneurshipCourse[] = [
  // Mandatory
  { id: '00324528', name: 'מנהיגות יזמית', credits: 2, mandatory: true },
  { id: null, name: 'יזמות טכנולוגית/מדעית בפקולטה בתחום הידע הנדרש', credits: 2, mandatory: true },
  // Electives
  { id: '00324527', name: 'יסודות היזמות', credits: 2, mandatory: false },
  { id: null, name: 'ניהול פרויקטים יזמיים', credits: 2, mandatory: false },
  { id: null, name: 'מנהיגות ויזמות חברתית', credits: 2, mandatory: false },
  { id: '00324520', name: 'יזמות עסקית', credits: 2, mandatory: false },
  { id: '00324541', name: 'גיוס המערכת האקולוגית העסקית', credits: 2, mandatory: false },
  { id: '00324521', name: 'יזמות בארגונים-התפתחויות ומגמות', credits: 2, mandatory: false },
  { id: '00324540', name: 'היבטים משפטיים ביזמות עסקית', credits: 2, mandatory: false },
  { id: '00324526', name: 'שיווק ליזמים', credits: 2, mandatory: false },
  { id: '00324536', name: 'הייטק בישראל: כיצד להוביל עולמית', credits: 2, mandatory: false },
  { id: null, name: 'שימושיות בממשקי תוכנה', credits: 2, mandatory: false },
  { id: '00324247', name: 'מבוא ליזמות וחשיבה עיצובית', credits: 2, mandatory: false },
  { id: '00324518', name: 'חדשנות', credits: 2, mandatory: false },
];

export const ENTREPRENEURSHIP_MINOR_MIN_CREDITS = 10;
export const ENTREPRENEURSHIP_MINOR_EXTRA_CREDITS = 5;
export const ENTREPRENEURSHIP_MINOR_MIN_GPA = 75.0;
export const ENTREPRENEURSHIP_MINOR_MIN_TOTAL_CREDITS = 36;
