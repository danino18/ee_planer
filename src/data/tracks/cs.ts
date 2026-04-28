import type { TrackDefinition } from '../../types';

export const csTrack: TrackDefinition = {
  id: 'cs',
  name: 'הנדסת מחשבים ותכנה',
  description: 'מכשיר מהנדסי מחשבים המתמחים בתכנון ובנייה של מערכות מחשב, תכנה וחומרה',
  totalCreditsRequired: 159.5,
  mandatoryCredits: 106.5,
  electiveCreditsRequired: 41,
  generalCreditsRequired: 12,
  specializationGroupsRequired: 2,
  electivePolicy: {
    facultyCourseAreas: ['ee', 'cs'],
  },
  coreRequirement: {
    courses: ['00440140','00440191','00440198','00440202','00460195','00460237','00460266'],
    required: 4,
  },
  semesterSchedule: [
    {
      semester: 1,
      courses: ['00440102','01040012','01040064','01140071','02340117','03240033'],
    },
    {
      semester: 2,
      courses: ['00440252','01040013','01040038','01040136','01140075'],
    },
    {
      semester: 3,
      courses: ['00440105','00440114','00440268','01040134','01040214','01040215','01040220'],
    },
    {
      semester: 4,
      courses: ['00440127','00440131','00440157','00440101','00460002','01040034'],
    },
    {
      semester: 5,
      courses: ['00440137','00460209','00460210','00440334','00460267'],
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
