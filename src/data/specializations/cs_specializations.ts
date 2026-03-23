import type { SpecializationGroup } from '../../types';

export const csSpecializations: SpecializationGroup[] = [
  {
    id: 'cs_networks', trackId: 'cs', name: 'רשתות מחשבים ואינטרנט',
    mandatoryCourses: ['00440334'],
    electiveCourses: ['00460005','00460001','00460002','00460203','00460197','00460195','00460205','00460209','00460272','00460280','02360350'],
    minCoursesToComplete: 3, canBeDouble: false,
  },
  {
    id: 'cs_comm', trackId: 'cs', name: 'תקשורת ומידע',
    mandatoryCourses: ['00440202'],
    electiveCourses: ['00460204','00460206','00460733','02360309','00440214','00440198','00440334','00460005','00460187','00460201','00460216','00460242','00460256','00460734','00460743','00460868'],
    minCoursesToComplete: 3, canBeDouble: false,
  },
  {
    id: 'cs_signal_image', trackId: 'cs', name: 'עיבוד אותות ותמונות',
    mandatoryCourses: [],
    electiveCourses: ['00440198','00460200','00460010','00460745','00460195','00460197','00460201','00460249','00460332','00460345','00460733','00460743','00460746','00460747'],
    minCoursesToComplete: 4, canBeDouble: false,
  },
  {
    id: 'cs_microelectronics', trackId: 'cs', name: 'מיקרואלקטרוניקה וננואלקטרוניקה',
    mandatoryCourses: [],
    electiveCourses: ['00440124','00460225','00440231','00460237','00460052','00460129','00460241','00440239','00460012','00460230','00460243','00460265'],
    minCoursesToComplete: 3, canBeDouble: false,
  },
  {
    id: 'cs_control', trackId: 'cs', name: 'בקרה ורובוטיקה',
    mandatoryCourses: ['00440191'],
    electiveCourses: ['00460192','00460212','00440139','00460042','00460203','00460195','00460196','00460197','00460189','00460213','00460868'],
    minCoursesToComplete: 3, canBeDouble: false,
  },
  {
    id: 'cs_algorithms', trackId: 'cs', name: 'אלגוריתמים ויסודות החישוב',
    mandatoryCourses: ['00460005'],
    electiveCourses: ['00460203','00460195','00460205','00460209','00460272','00460280','02360990','00460733','00460853','02360309','02360496'],
    minCoursesToComplete: 3, canBeDouble: false,
  },
  {
    id: 'cs_software', trackId: 'cs', name: 'מערכות תוכנה ושפות תכנות',
    mandatoryCourses: ['00460005'],
    electiveCourses: ['00460266','00460271','00460272','00460275','00460277','00460278','00460279','00460280','02360350','02360370','02360496'],
    minCoursesToComplete: 3, canBeDouble: false,
  },
  {
    id: 'cs_ml', trackId: 'cs', name: 'למידת מכונה ומערכות חכמות',
    mandatoryCourses: ['00460195'],
    electiveCourses: ['00460202','00460203','00460217','00460010','00440191','00460197','00460201','00460215','00460733','00460200','00460213','00460746','00460747','00460853'],
    minCoursesToComplete: 3, canBeDouble: false,
  },
  {
    id: 'cs_vlsi', trackId: 'cs', name: 'מעגלים אלקטרוניים ו-VLSI',
    mandatoryCourses: ['00460237'],
    electiveCourses: ['00460045','00460187','00460188','00460903','00440139','00460189','00460265','00460880','00460881','00460918'],
    minCoursesToComplete: 3, canBeDouble: false,
  },
  {
    id: 'cs_energy', trackId: 'cs', name: 'אנרגיה ומערכות אספקה',
    mandatoryCourses: ['00460042'],
    electiveCourses: ['00440139','00340034','00440191','00440198','00460044','00460045','00460197','00340035'],
    minCoursesToComplete: 3, canBeDouble: false,
  },
];
