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
  /**
   * What to do when the selector's target isn't found within the search timeout.
   * 'skip' (default) advances to the next step — used for chrome that's always mounted
   * once its screen is showing. 'describe' keeps the step centered with its text instead,
   * for features that only appear on screen under certain conditions.
   */
  fallback?: 'skip' | 'describe';
}

export const BASIC_TOUR_STEPS: TourStep[] = [
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
    id: 'degree-completion-btn',
    selector: '[data-tour="degree-completion-btn"]',
    title: 'בדיקת גמר תואר',
    body: 'לחצו כאן בכל שלב לקבלת דוח מפורט שמראה אם התכנית שלכם עומדת בכל דרישות התואר, כולל המלצות לקורסים חסרים.',
    advanceOn: 'button',
  },
  {
    id: 'catalog-year-select',
    selector: '[data-tour="catalog-year-select"]',
    title: 'שנת קטלוג',
    body: 'אם למסלול שלכם יש כמה שנתוני קבלה, כאן תוכלו לבחור לפי איזה קטלוג דרישות התואר ייבדקו.',
    advanceOn: 'button',
  },
  {
    id: 'degree-planning-menu',
    selector: '[data-tour="degree-planning-menu"]',
    title: 'אתחול המערכת',
    body: 'כאן תוכלו למלא אוטומטית תכנית מומלצת לפי המסלול שלכם, או להתחיל תכנון מאפס ולנקות את כל הקורסים.',
    advanceOn: 'button',
  },
  {
    id: 'login-btn',
    selector: '[data-tour="login-btn"]',
    title: 'התחברות עם Google',
    body: 'התחברות שומרת את התכנית שלכם בענן, מסנכרנת בין מכשירים, ומאפשרת ניהול גרסאות ושיתוף עם אחרים.',
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
    id: 'support-btn',
    selector: '[data-tour="support-btn"]',
    title: 'קבוצת תמיכה',
    body: 'יש שאלה על המערכת או על תכנון הלימודים? קבוצת הוואטסאפ כאן בשבילכם.',
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
    id: 'finish',
    selector: null,
    title: 'זהו, סיימנו! 🎉',
    body: 'אתם מוכנים להתחיל לתכנן. תוכלו לחזור להדרכה הזו בכל רגע דרך כפתור ה-"?" שנוסף לכותרת.',
    advanceOn: 'button',
  },
];

export const ADVANCED_TOUR_STEPS: TourStep[] = [
  {
    id: 'adv-welcome',
    selector: null,
    title: 'הדרכה מתקדמת ⚙️',
    body: 'הפעם נעבור על פיצ׳רים למשתמשים מנוסים — לא חובה לדעת אותם כדי להתחיל, אבל הם יעזרו לכם לדייק את התכנון.',
    advanceOn: 'button',
  },
  {
    id: 'course-card-chain-badge',
    selector: '[data-tour="course-card-chain-badge"]',
    title: 'שיבוץ קורס לשרשרת',
    body: 'כשקורס שייך למספר שרשראות התמחות, יופיע עליו תג "לא שובץ" בענבר. לחצו על הקורס כדי לפתוח את חלונית הפרטים שלו, ובחרו "הקצה" כדי לשבץ אותו לשרשרת ספציפית.',
    fallback: 'describe',
    advanceOn: 'button',
  },
  {
    id: 'course-card-postpone-icon',
    selector: '[data-tour="course-card-postpone-icon"]',
    title: 'דחיית קורס',
    body: 'אייקון 🔗 (עם מספר קטן) מופיע כשלקורס יש המשך שכבר משובץ בתכנית. המספר מראה כמה סמסטרים אפשר לדחות את הקורס קדימה לפני שהדחייה תתנגש עם הקורס התלוי בו.',
    fallback: 'describe',
    advanceOn: 'button',
  },
  {
    id: 'course-card-prereq-warning',
    selector: '[data-tour="course-card-prereq-warning"]',
    title: 'דרישות קדם',
    body: 'אייקון ⚠️ מסמן שחסרים לקורס דרישות קדם. בחלונית הפרטים של הקורס, תחת "תנאי קדם", אפשר לבחור איזו קבוצת קדמים להשתמש בה כשיש כמה אפשרויות, או אפילו להרכיב קדמים בעצמכם.',
    fallback: 'describe',
    advanceOn: 'button',
  },
  {
    id: 'view-toggle',
    selector: '[data-tour="view-toggle"]',
    title: 'תצוגות שונות ללוח',
    body: 'שלושה מצבי תצוגה ללוח הסמסטרים: גריד (כרטיסים), שורות (תצוגה מצומצמת), וחובה/בחירה (קיבוץ הקורסים לפי סוג הדרישה במקום לפי סמסטר).',
    advanceOn: 'button',
  },
  {
    id: 'grid-cols-stepper',
    selector: '[data-tour="grid-cols-stepper"]',
    title: 'מספר עמודות בתצוגת גריד',
    body: 'שולטים בכמה כרטיסי סמסטר מוצגים בשורה אחת — יותר עמודות לתצוגה מצומצמת, פחות עמודות לכרטיסים גדולים יותר.',
    advanceOn: 'button',
  },
  {
    id: 'search-filters',
    selector: '[data-tour="search-filters"]',
    title: 'כלי סינון בחיפוש',
    body: 'סננו קורסים לפי מקצוע, אנגלית, מל"ג, בחירה חופשית, תארים מתקדמים, סמסטר הוראה (חורף/אביב), דירוג CheeseFork מינימלי, וסטטיסטיקת ציונים.',
    advanceOn: 'button',
  },
  {
    id: 'sort-select',
    selector: '[data-tour="sort-select"]',
    title: 'מיון תוצאות חיפוש',
    body: 'מיינו את תוצאות החיפוש לפי מספר קורס, שם, נקודות זכות, או ציון ממוצע/חציון.',
    advanceOn: 'button',
  },
  {
    id: 'weighted-average-row',
    selector: '[data-tour="weighted-average-row"]',
    title: 'ממוצע משוקלל',
    body: 'השורה הזו בפאנל הדרישות מציגה את הממוצע המשוקלל הכולל שלכם. גם בכותרת כל עמודת סמסטר יופיע תג עם הממוצע המשוקלל של אותו סמסטר בלבד.',
    advanceOn: 'button',
  },
  {
    id: 'version-tabs',
    selector: '[data-tour="version-tabs"]',
    title: 'גרסאות תכנית',
    body: 'צרו, שכפלו, שנו שם, או מחקו גרסאות שונות של התכנית שלכם, ועברו ביניהן בקלות — שימושי לתרחישי "מה אם". (הכפתור "+ גרסה" מופיע לאחר שנוצרה גרסה ראשונה לתכנית.)',
    fallback: 'describe',
    advanceOn: 'button',
  },
  {
    id: 'version-compare-btn',
    selector: '[data-tour="version-compare-btn"]',
    title: 'השוואת גרסאות',
    body: 'כשיש לכם לפחות שתי גרסאות, כפתור "⇄ השווה" פותח תצוגה זו-לצד-זו שמראה את ההבדלים בקורסים ובהתקדמות הדרישות בין עד 4 גרסאות בו-זמנית.',
    fallback: 'describe',
    advanceOn: 'button',
  },
  {
    id: 'adv-finish',
    selector: null,
    title: 'זהו, עברתם על הפיצ׳רים המתקדמים! 🎉',
    body: 'אפשר לחזור להדרכה הזו בכל רגע דרך כפתור ה-"?" בכותרת ← "הדרכה מתקדמת".',
    advanceOn: 'button',
  },
];
