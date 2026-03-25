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
  semesterSchedule: [
    {
      semester: 1,
      courses: ['00440102','01040012','01040064','01040016','01140020','01140074','02340117','03240033'],
    },
    {
      semester: 2,
      courses: ['00440252','01040013','01040038','01040136','01140030','01140076'],
    },
    {
      semester: 3,
      courses: ['00440105','00440268','01040034','01040214','01040215','01040220','01140101','03940901'],
    },
    {
      semester: 4,
      courses: ['00440127','00440131','00440157','01150203','01140246','00440140','01140036'],
    },
    {
      semester: 5,
      courses: ['00440137','00440148','00440202','01150204','01160217','03940901'],
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
      courses: ['01140250','01140252'],
    },
  ],
};
