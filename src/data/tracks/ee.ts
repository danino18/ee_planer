import type { TrackDefinition } from '../../types';

export const eeTrack: TrackDefinition = {
  id: 'ee',
  name: 'הנדסת חשמל',
  description: 'המסלול הרחב ביותר בפקולטה. מאפשר התמחות בכל תחומי הנדסת החשמל והאלקטרוניקה',
  totalCreditsRequired: 157.5,
  mandatoryCredits: 106,
  electiveCreditsRequired: 39.5,
  generalCreditsRequired: 12,
  specializationGroupsRequired: 3,
  electivePolicy: {
    facultyCourseAreas: ['ee'],
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
      '00450120',
    ],
  },
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
      courses: ['00440105','00440268','00440157','01040214','01040215','01040220','01140073'],
    },
    {
      semester: 4,
      courses: ['00440127','00440131','00440140','01040034'],
    },
    {
      semester: 5,
      courses: ['00440137','00440148','00440202','00440158','00440124'],
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
