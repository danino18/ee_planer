import type { TrackDefinition } from '../../types';

export const eePhysicsTrack: TrackDefinition = {
  id: 'ee_physics',
  name: 'חשמל + פיזיקה',
  description: 'מגמה המשלבת הנדסת חשמל עם ידע מעמיק בפיזיקה. מאפשרת המשך לתואר שני במחקר',
  totalCreditsRequired: 162,
  mandatoryCredits: 124.5,
  electiveCreditsRequired: 25.5,
  generalCreditsRequired: 12,
  specializationGroupsRequired: 2,
  semesterSchedule: [
    {
      semester: 1,
      courses: ['00440102','01040012','01040064','01140071','01140032','02340117','03240033'],
    },
    {
      semester: 2,
      courses: ['00440252','01040013','01040038','01040136','01140075'],
    },
    {
      semester: 3,
      courses: ['00440105','00440268','01040286','01040214','01040215','01040220','01140073','03940901'],
    },
    {
      semester: 4,
      courses: ['00440131','00440127','00440157','00440140','01040222','03940800'],
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
