import type { TrackDefinition } from '../../types';

export const eeCombinedTrack: TrackDefinition = {
  id: 'ee_combined',
  name: 'מסלול משולב חשמל+פיזיקה (ב.מ.)',
  description: 'מסלול משולב לתואר ראשון ומוסמך בהנדסת חשמל ופיזיקה. 8 סמסטרים, 178 נ"ז',
  totalCreditsRequired: 178,
  mandatoryCredits: 136,
  electiveCreditsRequired: 30,
  generalCreditsRequired: 12,
  specializationGroupsRequired: 3,
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
  semesterSchedule: [
    {
      semester: 1,
      courses: ['00440102','01040012','01140020','01140074','02340117','03240033'],
      alternativeGroups: [
        {
          courseIds: ['01040064', '01040016'],
          defaultCourseId: '01040064',
        },
      ],
    },
    {
      semester: 2,
      courses: ['00440252','01040013','01040038','01040136','01140030','01140076'],
    },
    {
      semester: 3,
      courses: ['00440105','00440268','01040034','01040214','01040215','01040220','01140101'],
    },
    {
      semester: 4,
      courses: ['00440127','00440131','00440157','01150203','01140036'],
      alternativeGroups: [
        {
          courseIds: ['01140246', '00440140'],
          showBoth: true,
          warningText: '⚠️ במסלול הזה יש לבחור רק אחד: שדות אלקטרומגנטיים או אלקטרומגנטיות ואלקטרודינמיקה',
        },
      ],
    },
    {
      semester: 5,
      courses: ['00440137','00440148','00440202','01150204','01160217'],
    },
    {
      semester: 6,
      courses: ['00440158','00440167','01140035'],
    },
    {
      semester: 7,
      courses: ['00440169','01140037','01240108'],
    },
    {
      semester: 8,
      courses: [],
      alternativeGroups: [
        {
          courseIds: ['01140250', '01140252'],
          showBoth: true,
        },
      ],
    },
  ],
};
