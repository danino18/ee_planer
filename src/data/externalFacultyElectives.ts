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
