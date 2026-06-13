// Renders the in-memory "would insert" course list in several candidate
// storage formats (TS / JSON, formatted / minified) and measures their sizes,
// so the final storage format can be chosen before anything is written.

import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE_FILE = 'src/data/teachingSemesterFallback.ts';

export function courseFields(course) {
  const fields = {
    id: course.id,
    name: course.name,
    credits: course.credits,
    prerequisites: course.prerequisites,
  };
  if (course.noAdditionalCreditIds?.length) fields.noAdditionalCreditIds = course.noAdditionalCreditIds;
  if (course.containedCourseIds?.length) fields.containedCourseIds = course.containedCourseIds;
  fields.faculty = course.faculty;
  return fields;
}

function renderTsFormatted(courses) {
  const body = courses.map((course) => {
    const f = courseFields(course);
    const parts = Object.entries(f).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    return `  { ${parts.join(', ')} },`;
  }).join('\n');

  return [
    "import type { SapCourse } from '../types';",
    '',
    'export const historicalFallbackCourses: SapCourse[] = [',
    body,
    '];',
    '',
  ].join('\n');
}

export function renderTsMinified(courses) {
  const body = courses.map((course) => JSON.stringify(courseFields(course))).join(',');
  return `import type { SapCourse } from '../types';\nexport const historicalFallbackCourses: SapCourse[] = [${body}];\n`;
}

function byteLength(content) {
  return Buffer.byteLength(content, 'utf8');
}

function gzipLength(content) {
  return gzipSync(Buffer.from(content, 'utf8')).length;
}

function toKb(bytes) {
  return Math.round((bytes / 1024) * 100) / 100;
}

function measure(content) {
  const bytes = byteLength(content);
  const gzipBytes = gzipLength(content);
  return {
    bytes,
    kb: toKb(bytes),
    gzipBytes,
    gzipKb: toKb(gzipBytes),
  };
}

/** @param {object[]} courses Array of SapCourse-shaped objects to be inserted. */
export function buildSizeReport(courses) {
  const tsFormatted = renderTsFormatted(courses);
  const tsMinified = renderTsMinified(courses);
  const jsonFormatted = JSON.stringify(courses.map(courseFields), null, 2);
  const jsonMinified = JSON.stringify(courses.map(courseFields));

  const baselinePath = join(repoRoot, ...BASELINE_FILE.split('/'));
  const baselineContent = readFileSync(baselinePath, 'utf8');
  const baselineCourseCount = (baselineContent.match(/\{\s*id:/g) ?? []).length;

  return {
    courseCount: courses.length,
    tsFormatted: measure(tsFormatted),
    tsMinified: measure(tsMinified),
    jsonFormatted: measure(jsonFormatted),
    jsonMinified: measure(jsonMinified),
    baseline: {
      file: BASELINE_FILE,
      courseCount: baselineCourseCount,
      ...measure(baselineContent),
    },
  };
}
