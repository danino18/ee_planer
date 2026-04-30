export interface ExternalFacultyElectiveCourse {
  id: string;
  facultyCreditLimit?: number;
}

export const EXTERNAL_FACULTY_ELECTIVE_MAX_CREDITS = 9;

export const EXTERNAL_FACULTY_ELECTIVE_COURSES: ExternalFacultyElectiveCourse[] = [
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
