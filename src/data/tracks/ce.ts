import type { TrackDefinition } from '../../types';

export const ceTrack: TrackDefinition = {
  id: 'ce',
  name: 'הנדסת מחשבים',
  description: 'מסלול להנדסת מחשבים המשלב ידע בחומרה, תוכנה ומערכות מחשב מתקדמות',
  totalCreditsRequired: 158.5,
  mandatoryCredits: 113.5,
  electiveCreditsRequired: 27,
  generalCreditsRequired: 12,
  specializationGroupsRequired: 2,
  coreRequirement: {
    courses: ['00440198', '00440202', '02360334', '00440334', '02340292', '02360343'],
    required: 2,
    orGroups: [['02360334', '00440334']],
  },
  labPool: {
    required: 0,
    mandatory: false,
    max: 4,
    courses: [
      '00450100','00450101','00450102','00450103','00450104',
      '00450105','00450106','00450107','00450108','00450109',
      '00450110','00450111','00450112','00450113','00450114',
      '00450115','00450116','00450117','00450118','00450119',
      '00450120',
    ],
  },
  semesterSchedule: [
    {
      semester: 1,
      courses: ['00440102','01040012','01040064','01040016','02340129','01140071','02340114'],
    },
    {
      semester: 2,
      courses: ['01040013','02340125','01040136','01140075','00440252','03940901'],
    },
    {
      semester: 3,
      courses: ['02340124','02340141','00440105','01040220','01040215','01040214','03240033'],
    },
    {
      semester: 4,
      courses: ['00440131','01040034','00440127','02340218','02340118','03940901'],
    },
    {
      semester: 5,
      courses: ['00440137','00440157','02340123','01040134','02340247','00460267'],
    },
    {
      semester: 6,
      courses: ['00440167'],
    },
    {
      semester: 7,
      courses: ['00440169'],
    },
  ],
};
