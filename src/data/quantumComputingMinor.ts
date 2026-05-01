export interface QuantumMinorCourse {
  id: string;
  name: string;
  credits: number;
}

export interface QuantumMinorGroup {
  id: 'a' | 'b' | 'g1' | 'd' | 'e' | 'f';
  title: string;
  minCourses: number;
  courses: QuantumMinorCourse[];
}

export interface QuantumMinorG2Option {
  id: 'g2_1' | 'g2_2' | 'g2_3';
  title: string;
  courses: QuantumMinorCourse[];
}

export const QUANTUM_MINOR_GROUPS: QuantumMinorGroup[] = [
  {
    id: 'a',
    title: 'א. חישוביות',
    minCourses: 1,
    courses: [
      { id: '02360343', name: 'תורת החישוביות', credits: 3.0 },
    ],
  },
  {
    id: 'b',
    title: 'ב. קורס מבוא',
    minCourses: 1,
    courses: [
      { id: '02360990', name: 'מבוא לעיבוד אינפורמציה קוונטית', credits: 3.0 },
      { id: '01160031', name: 'תורת האינפורמציה הקוונטית', credits: 3.5 },
    ],
  },
  {
    id: 'g1',
    title: 'ג1. קוונטים',
    minCourses: 1,
    courses: [
      { id: '01240400', name: 'כימיה קוונטית 1', credits: 5.0 },
      { id: '01150203', name: 'פיזיקה קוונטית 1', credits: 5.0 },
      { id: '00460241', name: 'מכניקה קוונטית', credits: 3.5 },
    ],
  },
  {
    id: 'd',
    title: 'ד. אינפורמציה קוונטית מתקדמת',
    minCourses: 1,
    courses: [
      { id: '02360640', name: "נושאים מתקדמים באינפורמציה קוונטית ה'", credits: 2.0 },
      { id: '02360641', name: "נושאים מתקדמים באינפורמציה קוונטית ה'+ת'", credits: 3.0 },
      { id: '02360823', name: 'סמינר בעיבוד אינפורמציה קוונטית', credits: 2.0 },
      { id: '01160040', name: 'אינפורמציה קוונטית מתקדמת', credits: 2.0 },
      { id: '00460734', name: 'תורת האינפורמציה לתקשורת קוונטית', credits: 3.0 },
    ],
  },
  {
    id: 'e',
    title: 'ה. טכנולוגיות קוונטיות',
    minCourses: 1,
    courses: [
      { id: '00460243', name: 'טכנולוגיות קוונטיות', credits: 3.0 },
      { id: '01160083', name: 'טכנולוגיות קוונטיות', credits: 2.0 },
      { id: '02360991', name: 'פרויקט בחישוב קוונטי', credits: 3.0 },
      { id: '01160037', name: 'מחשוב קוונטי רועש', credits: 2.0 },
      { id: '01260604', name: "מעבדה בטכנולוגיות קוונטיות א'", credits: 2.0 },
      { id: '01260605', name: "מעבדה בטכנולוגיות קוונטיות ב'", credits: 4.0 },
    ],
  },
  {
    id: 'f',
    title: 'ו. קורס ליבה',
    minCourses: 1,
    courses: [
      { id: '02360313', name: 'תורת הסיבוכיות', credits: 3.0 },
      { id: '02360309', name: 'מבוא לתורת הצפינה', credits: 3.0 },
      { id: '02360518', name: 'סיבוכיות תקשורת', credits: 2.0 },
      { id: '02360359', name: 'אלגוריתמים 2', credits: 3.0 },
      { id: '02360521', name: 'אלגוריתמי קירוב', credits: 2.0 },
      { id: '02360330', name: 'מבוא לאופטימיזציה', credits: 3.0 },
      { id: '00460197', name: 'שיטות חישוביות באופטימיזציה', credits: 3.0 },
      { id: '02340292', name: 'לוגיקה למדמ"ח', credits: 3.0 },
      { id: '02360201', name: 'מבוא לייצוג ועיבוד מידע', credits: 3.0 },
      { id: '02360350', name: 'הגנה ברשתות', credits: 3.0 },
      { id: '02360506', name: 'קריפטולוגיה מודרנית', credits: 3.0 },
      { id: '02360334', name: 'מבוא לרשתות מחשבים', credits: 3.0 },
      { id: '00440334', name: 'רשתות מחשבים ואינטרנט 1', credits: 3.0 },
      { id: '02360370', name: 'תכנות מקבילי ומבוזר לעיבוד נתונים ולמידה חישובית', credits: 3.0 },
      { id: '02360501', name: 'מבוא לבינה מלאכותית', credits: 3.0 },
      { id: '02360766', name: 'מבוא ללמידת מכונה', credits: 3.5 },
    ],
  },
];

export const QUANTUM_MINOR_G2_OPTIONS: QuantumMinorG2Option[] = [
  {
    id: 'g2_1',
    title: 'ג2. אפשרות 1',
    courses: [
      { id: '01140073', name: 'פיזיקה קוונטית להנדסה', credits: 3.5 },
    ],
  },
  {
    id: 'g2_2',
    title: 'ג2. אפשרות 2',
    courses: [
      { id: '01140054', name: 'פיזיקה 3', credits: 5.0 },
      { id: '01040004', name: 'חדו"א 2', credits: 5.0 },
      { id: '01040131', name: "מד\"ר ח'", credits: 2.5 },
    ],
  },
  {
    id: 'g2_3',
    title: 'ג2. אפשרות 3',
    courses: [
      { id: '01140054', name: 'פיזיקה 3', credits: 5.0 },
      { id: '01040033', name: 'אנליזה וקטורית', credits: 2.5 },
      { id: '01040131', name: "מד\"ר ח'", credits: 2.5 },
    ],
  },
];

export const QUANTUM_MINOR_MIN_TOTAL_CREDITS = 30;
export const QUANTUM_MINOR_MIN_GPA = 85;
export const QUANTUM_MINOR_ADVISOR_GPA = 80;

