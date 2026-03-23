import type { TrackDefinition } from '../../types';

export const eeMathTrack: TrackDefinition = {
  id: 'ee_math',
  name: 'חשמל + מתמטיקה',
  description: 'מגמה לסטודנטים מצטיינים (ממוצע 87+). שילוב הנדסת חשמל עם ידע מעמיק במתמטיקה',
  totalCreditsRequired: 162,
  mandatoryCredits: 125,
  electiveCreditsRequired: 25,
  generalCreditsRequired: 12,
  specializationGroupsRequired: 2,
  semesterSchedule: [
    {
      semester: 1,
      courses: ['00440102','01040000','01040002','01040195','01040066','01140071','01140032','02340117'],
    },
    {
      semester: 2,
      courses: ['00440252','01040281','01040168','01140075','03240033'],
    },
    {
      semester: 3,
      courses: ['00440105','00440268','01040286','01040214','01040295','01040285','01040122'],
    },
    {
      semester: 4,
      courses: ['00440131','00440127','00440157','00440140','01040222','01040030','03940800'],
    },
    {
      semester: 5,
      courses: ['00440137','00440202','00440158','01040142','01040158','03940800'],
    },
    {
      semester: 6,
      courses: ['00440167','00440148','01040165'],
    },
    {
      semester: 7,
      courses: ['00440169'],
    },
  ],
};
