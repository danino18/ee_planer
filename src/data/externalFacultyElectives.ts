export interface ExternalFacultyElectiveCourse {
  id: string;
  facultyCreditLimit?: number;
}

export const EXTERNAL_FACULTY_ELECTIVE_MAX_CREDITS = 9;

export const EXTERNAL_FACULTY_ELECTIVE_COURSES: ExternalFacultyElectiveCourse[] = [
  // Official Technion list (ece.technion.ac.il/list-of-electives-from-other-faculties)
  { id: '00360026' },
  { id: '00840143' },
  { id: '00860759' },
  { id: '00860760' },
  { id: '00904591' },
  { id: '00940312' },
  { id: '00960570' },
  { id: '00970317' },
  { id: '01040142' },
  { id: '01040165' },
  { id: '01040177' },
  { id: '01340019' },
  { id: '01340020' },
  { id: '01250001' },
  { id: '01240510' },
  { id: '01240708' },
  { id: '01250800' },
  { id: '01250801' },
  { id: '01240120', facultyCreditLimit: 3 },
  { id: '03360325' },
  { id: '03360502' },
  { id: '03360504' },
  { id: '01140101' },
  { id: '01150204' },
  // Non-EE courses appearing in the ee/cs/ce track schedules
  // Math (010)
  { id: '01040012' },
  { id: '01040013' },
  { id: '01040016' },
  { id: '01040034' },
  { id: '01040038' },
  { id: '01040064' },
  { id: '01040134' },
  { id: '01040136' },
  { id: '01040214' },
  { id: '01040215' },
  { id: '01040220' },
  // Physics (011)
  { id: '01140032' },
  { id: '01140071' },
  { id: '01140073' },
  { id: '01140075' },
  // CS (023)
  { id: '02340114' },
  { id: '02340117' },
  { id: '02340118' },
  { id: '02340123' },
  { id: '02340124' },
  { id: '02340125' },
  { id: '02340129' },
  { id: '02340141' },
  { id: '02340218' },
  { id: '02340247' },
  { id: '02340292' },
  { id: '02360334' },
  { id: '02360343' },
  // Biology (032)
  { id: '03240033' },
  // Non-EE courses appearing in specialization groups across all tracks
  // Mechanical/Thermodynamics (003)
  { id: '00340034' },
  { id: '00340035' },
  // Biomedical/Neuro (003/035)
  { id: '00350001' },
  // Aerospace (008)
  { id: '00860755' },
  // Math specialization electives (010)
  { id: '01040144' },
  { id: '01040158' },
  { id: '01040193' },
  { id: '01040279' },
  { id: '01040280' },
  { id: '01040286' },
  { id: '01040291' },
  { id: '01040293' },
  { id: '01060349' },
  // Physics specialization electives (011)
  { id: '01160029' },
  { id: '01160031' },
  { id: '01160037' },
  { id: '01160041' },
  { id: '01160210' },
  // Chemistry (012)
  { id: '01240408' },
  { id: '01260604' },
  { id: '01260605' },
  // Biology/Life Sciences (013)
  { id: '01340058' },
  // CS specialization electives (023)
  { id: '02360216' },
  { id: '02360268' },
  { id: '02360299' },
  { id: '02360309' },
  { id: '02360313' },
  { id: '02360319' },
  { id: '02360321' },
  { id: '02360322' },
  { id: '02360329' },
  { id: '02360330' },
  { id: '02360341' },
  { id: '02360342' },
  { id: '02360345' },
  { id: '02360350' },
  { id: '02360351' },
  { id: '02360359' },
  { id: '02360360' },
  { id: '02360363' },
  { id: '02360370' },
  { id: '02360372' },
  { id: '02360373' },
  { id: '02360374' },
  { id: '02360376' },
  { id: '02360490' },
  { id: '02360491' },
  { id: '02360496' },
  { id: '02360500' },
  { id: '02360501' },
  { id: '02360506' },
  { id: '02360520' },
  { id: '02360522' },
  { id: '02360525' },
  { id: '02360703' },
  { id: '02360716' },
  { id: '02360719' },
  { id: '02360755' },
  { id: '02360760' },
  { id: '02360766' },
  { id: '02360780' },
  { id: '02360781' },
  { id: '02360860' },
  { id: '02360861' },
  { id: '02360862' },
  { id: '02360873' },
  { id: '02360927' },
  { id: '02360990' },
  // Biomedical Engineering (033)
  { id: '03360208' },
  { id: '03360522' },
];

const externalFacultyElectiveCourseById = new Map(
  EXTERNAL_FACULTY_ELECTIVE_COURSES.map((course) => [course.id, course]),
);

export function getExternalFacultyElectiveCourse(
  courseId: string,
): ExternalFacultyElectiveCourse | undefined {
  return externalFacultyElectiveCourseById.get(courseId);
}

export function isExternalFacultyElectiveCourseId(courseId: string): boolean {
  return externalFacultyElectiveCourseById.has(courseId);
}
