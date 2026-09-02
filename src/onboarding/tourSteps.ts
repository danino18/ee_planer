export interface TourStep {
  id: string;
  /** CSS selector for the element to spotlight, or null to center the tooltip with no spotlight. */
  selector: string | null;
  title: string;
  body: string;
  /** When true, the tour opens the mobile sidebar drawer while this step is active. */
  mobileOpensDrawer?: boolean;
  /** When 'track-selected', the tour advances automatically once a track is chosen instead of showing a Next button. */
  advanceOn?: 'button' | 'track-selected';
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    selector: null,
    title: 'ברוכים הבאים למתכנן הלימודים! 🎓',
    body: 'המערכת עוזרת לכם לתכנן את מסלול הלימודים שלכם, ובודקת אוטומטית מול דרישות התואר של הטכניון מה כבר הושלם, מה חסר, ומה מומלץ לקחת הלאה. בואו נעבור סיור קצר.',
    advanceOn: 'button',
  },
  {
    id: 'track-grid',
    selector: '[data-tour="track-grid"]',
    title: 'בחרו את מסלול הלימודים שלכם',
    body: 'לחצו על אחת הכרטיסיות כדי לבחור מסלול — חשמל, מחשבים, או אחד המסלולים המשולבים. תמיד תוכלו להחליף מסלול מאוחר יותר מהכותרת.',
    advanceOn: 'track-selected',
  },
  {
    id: 'header',
    selector: '[data-tour="header"]',
    title: 'זו המערכת שלכם',
    body: 'בכותרת תמצאו את כל הכלים המרכזיים: שיתוף וייצוא, החלפת מסלול, בדיקת גמר תואר, ועוד. בואו נעבור עליהם אחד-אחד.',
    advanceOn: 'button',
  },
  {
    id: 'course-search',
    selector: '[data-tour="course-search"]',
    title: 'חיפוש והוספת קורסים',
    body: 'חפשו קורס לפי שם או מספר, סננו לפי פקולטה או סמסטר, ולחצו על תוצאה כדי להוסיף אותה ישירות לתכנית שלכם.',
    advanceOn: 'button',
  },
  {
    id: 'semester-grid',
    selector: '[data-tour="semester-grid"]',
    title: 'גרירה וסידור הקורסים',
    body: 'גררו קורסים בין הסמסטרים כדי לסדר את התכנית שלכם. על כל כרטיסיית קורס תוכלו לראות ציון ממוצע היסטורי, נתוני CheeseFork ואזהרות על דרישות קדם.',
    advanceOn: 'button',
  },
  {
    id: 'requirements-panel',
    selector: '[data-tour="requirements-panel"]',
    title: 'מעקב אחרי דרישות התואר',
    body: 'כאן תוכלו לראות בכל רגע כמה נקודות זכות השלמתם בכל קטגוריה — חובה, בחירה, מעבדות ועוד — ומה עוד נשאר.',
    mobileOpensDrawer: true,
    advanceOn: 'button',
  },
  {
    id: 'specialization-panel',
    selector: '[data-tour="specialization-panel"]',
    title: 'בחירת התמחות',
    body: 'בחרו שרשרת התמחות שמעניינת אתכם, ועקבו אחרי אילו קורסים כלולים בה ומה עוד חסר להשלמתה.',
    mobileOpensDrawer: true,
    advanceOn: 'button',
  },
  {
    id: 'degree-completion-btn',
    selector: '[data-tour="degree-completion-btn"]',
    title: 'בדיקת גמר תואר',
    body: 'לחצו כאן בכל שלב לקבלת דוח מפורט שמראה אם התכנית שלכם עומדת בכל דרישות התואר, כולל המלצות לקורסים חסרים.',
    advanceOn: 'button',
  },
  {
    id: 'export-share-btn',
    selector: '[data-tour="export-share-btn"]',
    title: 'שיתוף, ייצוא וגיבוי',
    body: 'ייצאו את התכנית שלכם כ-PDF או קובץ גיבוי, שתפו אותה עם חבר לעריכה משותפת, או ייבאו תכנית קיימת. שימו לב גם לכפתור ה"בטל" לביטול פעולה אחרונה, ולטאבים למעלה למספר גרסאות של התכנית.',
    advanceOn: 'button',
  },
  {
    id: 'finish',
    selector: null,
    title: 'זהו, סיימנו! 🎉',
    body: 'אתם מוכנים להתחיל לתכנן. תוכלו לחזור להדרכה הזו בכל רגע דרך כפתור ה-"?" שנוסף לכותרת.',
    advanceOn: 'button',
  },
];
