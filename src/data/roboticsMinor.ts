export interface RoboticsCourse {
  id: string;
  name: string;
  credits: number;
  outsideEE?: boolean; // only relevant for list 5
}

export interface RoboticsMinorList {
  listNumber: 1 | 2 | 3 | 4 | 5;
  title: string;
  minCourses: number;
  courses: RoboticsCourse[];
}

export const ROBOTICS_MINOR_LISTS: RoboticsMinorList[] = [
  {
    listNumber: 1,
    title: 'קדם',
    minCourses: 1,
    courses: [
      { id: '00340040', name: 'מבוא לבקרה', credits: 3.0 },
      { id: '00350188', name: 'תורת הבקרה', credits: 3.5 },
      { id: '00440191', name: 'מערכות בקרה 1', credits: 4.0 },
      { id: '00440268', name: 'מבוא למבני נתונים ואלגוריתמים', credits: 3.0 },
      { id: '00440202', name: 'אותות אקראיים', credits: 3.0 },
      { id: '00840738', name: 'תורת הבקרה', credits: 3.0 },
      { id: '00860733', name: "תהליכים אקראיים במע' אוויר'", credits: 3.0 },
      { id: '00940224', name: 'מבני נתונים ואלגוריתמים', credits: 4.0 },
      { id: '00940312', name: 'מודלים דטרמיניסטיים בחקר ביצועים', credits: 4.0 },
      { id: '02340268', name: 'מבני נתונים ואלגוריתמים', credits: 3.0 },
    ],
  },
  {
    listNumber: 2,
    title: 'מבוא לרובוטיקה',
    minCourses: 1,
    courses: [
      { id: '00350001', name: 'מבוא לרובוטיקה', credits: 2.5 },
      { id: '00460212', name: "מבוא לרובוטיקה ח'", credits: 3.0 },
      { id: '02360927', name: 'מבוא לרובוטיקה', credits: 3.0 },
    ],
  },
  {
    listNumber: 3,
    title: 'למידה ובינה מלאכותית',
    minCourses: 1,
    courses: [
      { id: '00360049', name: 'רשתות עצביות לבקרה ודיאגנוסטיקה', credits: 2.5 },
      { id: '00460195', name: 'מערכות לומדות', credits: 3.5 },
      { id: '02360756', name: 'מבוא למערכות לומדות', credits: 3.0 },
      { id: '00960411', name: 'למידה חישובית 1', credits: 3.0 },
      { id: '00960210', name: 'יסודות בינה מלאכותית ויישומיה', credits: 3.5 },
      { id: '02360501', name: 'מבוא לבינה מלאכותית', credits: 3.0 },
    ],
  },
  {
    listNumber: 4,
    title: 'עבודה מעשית',
    minCourses: 1,
    courses: [
      { id: '00340401', name: 'מעבדה מתקדמת לרובוטים', credits: 2.5 },
      { id: '00850705', name: 'מעבדה בבקרה', credits: 2.5 },
      { id: '00950111', name: 'תכן מערכות יצור', credits: 3.5 },
      { id: '02360006', name: 'נושאים בבינה מלאכותית ורובוטיקה', credits: 3.0 },
      { id: '00460214', name: 'פרויקט ברובוטים ניידים', credits: 1.0 },
      { id: '00440167', name: 'פרויקט רכבים אוטונומיים', credits: 4.0 },
    ],
  },
  {
    listNumber: 5,
    title: 'קורסים מתקדמים',
    minCourses: 4,
    courses: [
      { id: '00360026', name: 'קינמטיקה דינמיקה ובקרה של רובוטים', credits: 3.0, outsideEE: true },
      { id: '00360044', name: 'תכן תנועת רובוטים וניווט ע"י חיישנים', credits: 3.0, outsideEE: true },
      { id: '00860762', name: 'ניווט וחישת עולם אוטונומיים', credits: 3.0, outsideEE: true },
      { id: '00860761', name: 'ניווט ומיפוי מבוסס ראיה ממוחשבת', credits: 3.0, outsideEE: true },
      { id: '00460213', name: 'רובוטים ניידים', credits: 3.0, outsideEE: false },
      { id: '00460203', name: 'תכנון ולמידה מחיזוקים', credits: 3.0, outsideEE: false },
      { id: '00970244', name: 'רובוטים קוגניטיביים', credits: 3.0, outsideEE: true },
      { id: '00960208', name: 'בינה מלאכותית ומערכות אוטונומיות', credits: 3.0, outsideEE: true },
      { id: '02360203', name: 'נושאים בבינה מלאכותית שיתופית', credits: 3.0, outsideEE: true },
      { id: '02360767', name: 'אלגוריתמים לתכנון תנועה רובוטי', credits: 3.0, outsideEE: true },
    ],
  },
];

export const ROBOTICS_MINOR_POOL_REQUIRED = 27;
export const ROBOTICS_MINOR_EXTRA_CREDITS = 5;
export const ROBOTICS_MINOR_MIN_GPA = 87.0;
export const ROBOTICS_MINOR_MIN_TOTAL_CREDITS = 60;
export const ROBOTICS_LIST5_MIN_COURSES = 4;
export const ROBOTICS_LIST5_MIN_OUTSIDE_EE = 2;
