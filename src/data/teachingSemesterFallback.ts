// Backup teaching-semester data based on:
// C:\Users\eyald\Downloads\רשימת_מקצועות_מסוננת.md

export type FallbackTeachingSemester = 'winter' | 'spring';

export interface TeachingSemesterFallbackCourse {
  id: string;
  name: string;
  teachingSemester: FallbackTeachingSemester;
  credits?: number;
}

export const teachingSemesterFallbackCourses: TeachingSemesterFallbackCourse[] = [
  { id: '00440139', name: 'ממירי מתח ממותגים', teachingSemester: 'winter', credits: 3 },
  { id: '00440214', name: 'טכניקות קליטה ושידור', teachingSemester: 'winter', credits: 3 },
  { id: '00440231', name: 'התקנים אלקטרוניים 1', teachingSemester: 'winter', credits: 4 },
  { id: '00460248', name: 'פוטוניקה ולייזרים', teachingSemester: 'winter', credits: 3 },
  { id: '00450000', name: 'יזמות בהיי-טק', teachingSemester: 'winter', credits: 2 },
  { id: '00450001', name: 'פרויקט מבוא בהנדסת חשמל ומחשבים', teachingSemester: 'winter', credits: 1 },
  { id: '00450002', name: 'מבט-על להנדסת חשמל ומחשבים', teachingSemester: 'winter', credits: 1 },
  { id: '00460010', name: 'הסקה סטטיסטית', teachingSemester: 'winter', credits: 3 },
  { id: '00460012', name: 'מבוא לאלקטרוניקה גמישה אורגנית', teachingSemester: 'winter', credits: 3 },
  { id: '00460042', name: 'מבוא למע. הספק ורשת חכמה', teachingSemester: 'winter', credits: 3.5 },
  { id: '00460044', name: 'מערכות אנרגיה מתחדשת', teachingSemester: 'spring', credits: 3 },
  { id: '00460045', name: 'תכן ממירים ממותגים', teachingSemester: 'spring', credits: 3 },
  { id: '00460052', name: 'אופטואלקטרוניקה קוונטית', teachingSemester: 'winter', credits: 3 },
  { id: '00460054', name: 'מחשוב קוונטי מודרני', teachingSemester: 'spring', credits: 3 },
  { id: '00460055', name: 'ננו-פוטוניקה', teachingSemester: 'spring', credits: 3 },
  { id: '00460187', name: 'תכן מעגלים אנלוגיים', teachingSemester: 'winter', credits: 3 },
  { id: '00460188', name: 'מעגלים אלקט. לאותות מעורבים', teachingSemester: 'spring', credits: 3 },
  { id: '00460189', name: 'תכן מסננים אנלוגיים', teachingSemester: 'winter', credits: 3 },
  { id: '00460192', name: 'בקרה 2', teachingSemester: 'winter', credits: 3 },
  { id: '00460197', name: 'שיטות חישוביות באופטימיזציה', teachingSemester: 'winter', credits: 3 },
  { id: '00460201', name: 'עיבוד אותות אקראיים', teachingSemester: 'winter', credits: 3 },
  { id: '00460202', name: 'עיבוד וניתוח מידע', teachingSemester: 'winter', credits: 3 },
  { id: '00460203', name: 'תכנון ולמידה מחיזוקים', teachingSemester: 'spring', credits: 3 },
  { id: '00460204', name: 'תקשורת אנלוגית', teachingSemester: 'spring' },
  { id: '00460205', name: 'מבוא לתורת הקידוד בתקשורת', teachingSemester: 'spring', credits: 3 },
  { id: '00460208', name: 'טכניקות תקשורת מודרניות', teachingSemester: 'spring', credits: 3 },
  { id: '00460212', name: "מבוא לרובוטיקה ח'", teachingSemester: 'winter', credits: 3 },
  { id: '00460213', name: 'רובוטים ניידים', teachingSemester: 'spring', credits: 3 },
  { id: '00460214', name: 'פרויקט ברובוטים ניידים', teachingSemester: 'spring', credits: 3 },
  { id: '00460215', name: 'למידה עמוקה וחבורות', teachingSemester: 'spring', credits: 3 },
  { id: '00460232', name: 'פרקים בננו-אלקטרוניקה', teachingSemester: 'winter', credits: 3 },
  { id: '00460239', name: 'מעבדה בננו-אלקטרוניקה', teachingSemester: 'spring', credits: 3 },
  { id: '00460240', name: 'התקנים קוואנטים על מוליכים', teachingSemester: 'spring', credits: 3 },
  { id: '00460241', name: 'מכניקה קוונטית', teachingSemester: 'winter', credits: 3 },
  { id: '00460243', name: 'טכנולוגיות קוונטיות', teachingSemester: 'spring', credits: 3 },
  { id: '00460249', name: 'מערכות אלקטרו-אופטיות', teachingSemester: 'spring', credits: 3 },
  { id: '00460251', name: 'פוטוניקה בסיליקון', teachingSemester: 'winter', credits: 3 },
  { id: '00460256', name: 'אנטנות וקרינה', teachingSemester: 'winter', credits: 3 },
  { id: '00460257', name: 'מבוא למאיצי חלקיקים', teachingSemester: 'winter' },
  { id: '00460265', name: 'ארכיטקטורות ומעגלים בשילוב ממריסטורים', teachingSemester: 'winter' },
  { id: '00460266', name: 'שיטות הידור (קומפילציה)', teachingSemester: 'winter', credits: 3 },
  { id: '00460271', name: 'תכנות ותכן מונחה עצמים', teachingSemester: 'spring', credits: 3 },
  { id: '00460272', name: 'מערכות מבוזרות: עקרונות', teachingSemester: 'winter', credits: 3 },
  { id: '00460275', name: 'תרגום ואופטימיזציה של קוד בינארי', teachingSemester: 'spring', credits: 3 },
  { id: '00460277', name: 'הבטחת נכונות של תוכנה', teachingSemester: 'spring', credits: 3 },
  { id: '00460278', name: 'מאיצים חישוביים ומערכות מואצות', teachingSemester: 'spring' },
  { id: '00460279', name: 'חישוב מקבילי מואץ', teachingSemester: 'spring', credits: 3 },
  { id: '00460280', name: 'עקרונות וכלים באבטחת מחשבים', teachingSemester: 'winter', credits: 3 },
  { id: '00460326', name: 'מבוא לאותות ומערכות ביולוגיים', teachingSemester: 'winter', credits: 3 },
  { id: '00460332', name: 'מערכות ראיה ושמיעה', teachingSemester: 'winter', credits: 3 },
  { id: '00460734', name: 'תורת האינפורמציה לתקשורת קוונטית', teachingSemester: 'winter', credits: 3 },
  { id: '00460745', name: 'עבוד ספרתי של אותות', teachingSemester: 'winter', credits: 3 },
  { id: '00460746', name: "אלגו' ויישומים בראיה ממוחשבת", teachingSemester: 'spring', credits: 3 },
  { id: '00460747', name: 'למידה עמוקה לאותות דיבור', teachingSemester: 'winter', credits: 3 },
  { id: '00460773', name: 'התקני מל"מ א"א לגילוי', teachingSemester: 'winter', credits: 3 },
  { id: '00460831', name: 'מבוא לדימות רפואי', teachingSemester: 'spring', credits: 3 },
  { id: '00460864', name: 'ערוצי תקשורת מהירים בין שבבים', teachingSemester: 'spring', credits: 3 },
  { id: '00460868', name: 'יסודות תהליכים אקראיים', teachingSemester: 'spring', credits: 3 },
  { id: '00460880', name: 'תכן לוגי ממוחשב של שבבים', teachingSemester: 'winter', credits: 3 },
  { id: '00460881', name: 'אימות פורמלי לחומרה', teachingSemester: 'winter', credits: 3 },
  { id: '00460887', name: 'מבוא למחקר פקולטי', teachingSemester: 'spring', credits: 3 },
  { id: '00460903', name: 'מעגלים משולבים ב – CMOS', teachingSemester: 'spring', credits: 3 },
  { id: '00460918', name: 'תכן פיזי ממוחשב של שבבים', teachingSemester: 'spring', credits: 3 },
  { id: '00460968', name: 'מיקרו עיבוד ומיקרו מערכות', teachingSemester: 'spring', credits: 3 },
  { id: '00470100', name: 'נושאים נבחרים – במקורות אולטרה מהירים מבוססי סיבים', teachingSemester: 'winter', credits: 3 },
  { id: '00440098', name: 'מבוא להנדסת חשמל תעופה וחלל', teachingSemester: 'spring', credits: 4 },
  { id: '00460007', name: 'נושאים נבחרים ברשתות מחשבים למערכות למידה', teachingSemester: 'spring' },
  { id: '00460882', name: 'נושאים נבחרים בתכנון משולב חומרה/תוכנה', teachingSemester: 'spring' },
];

export const fallbackTeachingSemesterByCourseId = Object.fromEntries(
  teachingSemesterFallbackCourses.map((course) => [course.id, course.teachingSemester]),
) as Record<string, FallbackTeachingSemester>;
