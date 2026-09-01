import type { TrackDefinition } from '../../types';

export const eeCombinedTrack: TrackDefinition = {
  id: 'ee_combined',
  name: 'מסלול משולב חשמל+פיזיקה (ב.מ.)',
  description: 'מסלול משולב לתואר ראשון ומוסמך בהנדסת חשמל ופיזיקה. 8 סמסטרים, 178 נ"ז',
  // Base = entry year 2021/22
  totalCreditsRequired: 179.5,
  mandatoryCredits: 136,
  electiveCreditsRequired: 30,
  generalCreditsRequired: 12,
  specializationGroupsRequired: 2,
  electivePolicy: {
    facultyCourseAreas: ['ee'],
    areaRequirements: [
      { area: 'ee', minCredits: 22 },
      {
        area: 'physics',
        minCredits: 5,
        requiredAnyOfCourseIds: [
          '01160210',
          '01160029',
          '01160031',
          '01160354',
          '01160004',
          '01160027',
        ],
      },
    ],
    manualAssignmentAreas: {
      physics: ['physics', 'ee', 'general'],
    },
  },
  labPool: {
    required: 3,
    mandatory: true,
    max: 4,
    courses: [
      '00450100','00450101','00450102','00450103','00450104',
      '00450105','00450106','00450107','00450108','00450109',
      '00450110','00450111','00450112','00450113','00450114',
      '00450115','00450116','00450117','00450118','00450119',
      '00450120','00450121',
    ],
  },
  semesterSchedule: [
    {
      semester: 1,
      // 2021/22: Calculus 1M = 104031; Linear Algebra 1 = 104016 (direct, no alt group)
      courses: ['00440102','01040031','01040016','01140020','01140074','02340117','03240033'],
    },
    {
      semester: 2,
      // 2021/22: 104035 only; no 104038/104136; 114030 still in sem 3; includes 039409.01
      courses: ['00440252','01040013','01040035','01140076','03940901'],
    },
    {
      semester: 3,
      // 2021/22: 104221 + 104223 (not 104214/104215/104220); 114030 here
      courses: ['00440105','00440268','01040034','01040221','01040223','01140101','01140030'],
    },
    {
      semester: 4,
      // 2021/22: 114246 replaces 440140 (alt group)
      courses: ['00440127','00440131','00440157','01150203','01140036'],
      alternativeGroups: [
        { courseIds: ['01140246','00440140'], defaultCourseId: '01140246' },
      ],
    },
    {
      semester: 5,
      // 2021/22: includes 114035 (moves to sem 6 in 2023/24)
      courses: ['00440137','00440148','00440202','01150204','01160217','01140035'],
    },
    {
      semester: 6,
      courses: ['00440158','00440167','01140037'],
    },
    {
      semester: 7,
      // 2021/22: includes 440159 (dropped in 2023/24)
      courses: ['00440159','00440169','01240108'],
    },
    {
      semester: 8,
      // 2021/22: includes 440166 (dropped in 2023/24); 114250 replaces 114252
      courses: ['00440166'],
      alternativeGroups: [
        { courseIds: ['01140250','01140252'], defaultCourseId: '01140250' },
      ],
    },
  ],

  yearVariants: {
    // 2021/22: base schedule (no overrides)
    2021: {},

    // 2022/23: Calculus 1M = 104036; sem 2 gains 104038+104136 (drops 104035 and 039409.01);
    //          sem 3 → 104214/104215/104220
    2022: {
      totalCreditsRequired: 180,
      semesterSchedule: [
        { semester: 1, courses: ['00440102','01040036','01040016','01140020','01140074','02340117','03240033'] },
        { semester: 2, courses: ['00440252','01040013','01040038','01040136','01140076'] },
        { semester: 3, courses: ['00440105','00440268','01040034','01040214','01040215','01040220','01140101','01140030'] },
        {
          semester: 4,
          courses: ['00440127','00440131','00440157','01150203','01140036'],
          alternativeGroups: [
            { courseIds: ['01140246','00440140'], defaultCourseId: '01140246' },
          ],
        },
        { semester: 5, courses: ['00440137','00440148','00440202','01150204','01160217','01140035'] },
        { semester: 6, courses: ['00440158','00440167','01140037'] },
        { semester: 7, courses: ['00440159','00440169','01240108'] },
        {
          semester: 8,
          courses: ['00440166'],
          alternativeGroups: [
            { courseIds: ['01140250','01140252'], defaultCourseId: '01140250' },
          ],
        },
      ],
    },

    // 2023/24: Calculus 1M = 104012; 104064 replaces 104016; 114030 moves to sem 2;
    //          114246 now direct (no replaces); 114035 moves to sem 6;
    //          440159 and 440166 dropped
    2023: {
      totalCreditsRequired: 176,
      semesterSchedule: [
        {
          semester: 1,
          courses: ['00440102','01040012','01140020','01140074','02340117','03240033'],
          alternativeGroups: [
            { courseIds: ['01040064','01040016'], defaultCourseId: '01040064' },
          ],
        },
        { semester: 2, courses: ['00440252','01040013','01040038','01040136','01140030','01140076'] },
        { semester: 3, courses: ['00440105','00440268','01040034','01040214','01040215','01040220','01140101'] },
        { semester: 4, courses: ['00440127','00440131','00440157','01150203','01140246','01140036'] },
        { semester: 5, courses: ['00440137','00440148','00440202','01150204','01160217'] },
        { semester: 6, courses: ['00440158','00440167','01140035'] },
        { semester: 7, courses: ['00440169','01140037','01240108'] },
        {
          semester: 8,
          courses: [],
          alternativeGroups: [
            { courseIds: ['01140250','01140252'], defaultCourseId: '01140250' },
          ],
        },
      ],
    },

    // 2025/26: 104016/104064 as alt group in sem 1; sem 3 drops 114030;
    //          sem 4: showBoth for 114246/440140
    2025: {
      totalCreditsRequired: 178,
      semesterSchedule: [
        {
          semester: 1,
          courses: ['00440102','01040012','01140020','01140074','02340117','03240033'],
          alternativeGroups: [
            { courseIds: ['01040064','01040016'], defaultCourseId: '01040064' },
          ],
        },
        { semester: 2, courses: ['00440252','01040013','01040038','01040136','01140030','01140076'] },
        { semester: 3, courses: ['00440105','00440268','01040034','01040214','01040215','01040220','01140101'] },
        {
          semester: 4,
          courses: ['00440127','00440131','00440157','01150203','01140036'],
          alternativeGroups: [
            {
              courseIds: ['01140246','00440140'],
              showBoth: true,
              warningText: '⚠️ במסלול הזה יש לבחור רק אחד: שדות אלקטרומגנטיים או אלקטרומגנטיות ואלקטרודינמיקה',
            },
          ],
        },
        { semester: 5, courses: ['00440137','00440148','00440202','01150204','01160217'] },
        { semester: 6, courses: ['00440158','00440167','01140035'] },
        { semester: 7, courses: ['00440169','01140037','01240108'] },
        {
          semester: 8,
          courses: [],
          alternativeGroups: [
            { courseIds: ['01140250','01140252'], showBoth: true },
          ],
        },
      ],
    },

    // 2026/27 (תשפ"ז): no track-level credit/schedule changes announced; restated in full
    // since year-variant resolution is exact-match, not cumulative from 2025.
    2026: {
      totalCreditsRequired: 178,
      semesterSchedule: [
        {
          semester: 1,
          courses: ['00440102','01040012','01140020','01140074','02340117','03240033'],
          alternativeGroups: [
            { courseIds: ['01040064','01040016'], defaultCourseId: '01040064' },
          ],
        },
        { semester: 2, courses: ['00440252','01040013','01040038','01040136','01140030','01140076'] },
        { semester: 3, courses: ['00440105','00440268','01040034','01040214','01040215','01040220','01140101'] },
        {
          semester: 4,
          courses: ['00440127','00440131','00440157','01150203','01140036'],
          alternativeGroups: [
            {
              courseIds: ['01140246','00440140'],
              showBoth: true,
              warningText: '⚠️ במסלול הזה יש לבחור רק אחד: שדות אלקטרומגנטיים או אלקטרומגנטיות ואלקטרודינמיקה',
            },
          ],
        },
        { semester: 5, courses: ['00440137','00440148','00440202','01150204','01160217'] },
        { semester: 6, courses: ['00440158','00440167','01140035'] },
        { semester: 7, courses: ['00440169','01140037','01240108'] },
        {
          semester: 8,
          courses: [],
          alternativeGroups: [
            { courseIds: ['01140250','01140252'], showBoth: true },
          ],
        },
      ],
    },
  },
};
