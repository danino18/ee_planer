/**
 * Seed Firestore /degreeRules collection from TypeScript track definitions and JSON specialization files.
 *
 * Prerequisites:
 *   npm install          (installs firebase-admin + tsx devDependencies)
 *   Download a Firebase service account key JSON from:
 *     Firebase console → Project settings → Service accounts → Generate new private key
 *   Place it at the project root as service-account.json  (or set GOOGLE_APPLICATION_CREDENTIALS)
 *
 * Usage:
 *   npm run seed:degree-rules
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import type { TrackDefinition, TrackId } from '../src/types/index.js';
import type {
  CatalogYearRules,
  FirestoreTrackMeta,
  FirestoreSpecializationGroup,
  RequirementGroupDef,
} from '../src/types/firestoreRules.js';

import { eeTrack } from '../src/data/tracks/ee.js';
import { csTrack } from '../src/data/tracks/cs.js';
import { eeMathTrack } from '../src/data/tracks/ee_math.js';
import { eePhysicsTrack } from '../src/data/tracks/ee_physics.js';
import { eeCombinedTrack } from '../src/data/tracks/ee_combined.js';
import { ceTrack } from '../src/data/tracks/ce.js';
import { CS_SPECIALIZATION_YEAR_VARIANTS } from '../src/data/specializations/cs_specializations.js';

// ── Firebase init ────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SA_PATH = path.join(ROOT, 'service-account.json');

if (!getApps().length) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? SA_PATH;
  initializeApp({ credential: cert(credPath) });
}
const db = getFirestore();

// ── Tracks ───────────────────────────────────────────────────────────────────

const ALL_TRACKS: TrackDefinition[] = [
  eeTrack, csTrack, eeMathTrack, eePhysicsTrack, eeCombinedTrack, ceTrack,
];

/** Maps faculty area names to Technion course ID prefixes */
const AREA_TO_PREFIX: Record<string, string> = {
  ee: '004',
  math: '010',
  physics: '011',
  cs: '023',
  humanities: '032',
};

/** Specialization group folder names per track (mirrors engine.ts TRACK_SPECIALIZATION_FOLDERS) */
const TRACK_SPECIALIZATION_FOLDERS: Record<TrackId, string> = {
  ee: 'מסלול הנדסת חשמל',
  cs: 'מסלול הנדסת מחשבים ותוכנה',
  ee_math: 'מסלול הנדסת חשמל ומתמטיקה',
  ee_physics: 'מסלול הנדסת חשמל ופיזיקה',
  ee_combined: 'מסלול משולב-חשמל-פיסיקה(178 נקז)',
  ce: 'מסלול הנדסת מחשבים',
};

// ── Conversion helpers ────────────────────────────────────────────────────────

function resolveTrack(base: TrackDefinition, year: number): TrackDefinition {
  const variant = base.yearVariants?.[year] ?? {};
  return { ...base, ...variant };
}

function buildRequirementGroups(track: TrackDefinition): RequirementGroupDef[] {
  const groups: RequirementGroupDef[] = [];
  const areas = (track.electivePolicy?.facultyCourseAreas ?? ['ee']) as string[];

  // 1 – Mandatory courses (semester schedule)
  groups.push({
    id: 'mandatory',
    title: 'קורסי חובה',
    targetValue: track.mandatoryCredits,
    targetUnit: 'credits',
    groupType: 'mandatory_schedule',
    displaySection: 'mandatory',
  });

  // 2 – Faculty electives
  groups.push({
    id: 'elective_faculty',
    title: 'קורסי בחירה פקולטית',
    targetValue: track.electiveCreditsRequired,
    targetUnit: 'credits',
    groupType: 'elective_faculty',
    displaySection: 'elective',
    courseSelector: {
      facultyAreas: areas as RequirementGroupDef['courseSelector'] extends { facultyAreas?: (infer A)[] | undefined } ? A[] : never,
      idPrefixes: areas.map((a) => AREA_TO_PREFIX[a]).filter((p): p is string => !!p),
      areaRequirements: track.electivePolicy?.areaRequirements,
    },
    externalFacultyElectiveEnabled: track.externalFacultyElectiveEnabled,
  });

  // 3 – Specialization groups (counts as part of electives)
  groups.push({
    id: 'specialization_groups',
    title: 'קבוצות התמחות',
    targetValue: track.specializationGroupsRequired,
    targetUnit: 'courses',
    groupType: 'specialization_groups',
    displaySection: 'elective',
  });

  // 4 – Lab pool
  if (track.labPool) {
    groups.push({
      id: 'labs',
      title: 'מעבדות',
      targetValue: track.labPool.required,
      targetUnit: 'courses',
      groupType: 'course_pool',
      displaySection: 'mandatory',
      courseSelector: { ids: track.labPool.courses },
      poolRequired: track.labPool.required,
      poolMax: track.labPool.max,
      poolMandatory: track.labPool.mandatory,
    });
  }

  // 5 – Core requirement
  if (track.coreRequirement) {
    groups.push({
      id: 'core',
      title: 'קורסי ליבה',
      targetValue: track.coreRequirement.required,
      targetUnit: 'courses',
      groupType: 'course_pool',
      displaySection: 'elective',
      courseSelector: { ids: track.coreRequirement.courses },
      poolRequired: track.coreRequirement.required,
      orGroups: track.coreRequirement.orGroups?.map((courses) => ({ courses })),
    });
  }

  // 6 – General electives (Technion-wide, 12 credits)
  groups.push({
    id: 'general_elective',
    title: 'קורסי בחירה כלל טכניונים',
    targetValue: track.generalCreditsRequired,
    targetUnit: 'credits',
    groupType: 'predefined_classifier',
    courseSelector: { classifierKey: 'general_elective' },
    displaySection: 'general',
  });

  // 7 – Sport
  groups.push({
    id: 'sport',
    title: 'ספורט / חינוך גופני',
    targetValue: 2,
    targetUnit: 'credits',
    groupType: 'predefined_classifier',
    courseSelector: { classifierKey: 'sport' },
    displaySection: 'general',
  });

  // 8 – Free elective (מלג)
  groups.push({
    id: 'free_elective',
    title: 'בחירה חופשית',
    targetValue: 6,
    targetUnit: 'credits',
    groupType: 'predefined_classifier',
    courseSelector: { classifierKey: 'free_elective' },
    displaySection: 'general',
  });

  // 9 – English-taught courses
  groups.push({
    id: 'english',
    title: 'קורסים באנגלית',
    targetValue: 2,
    targetUnit: 'courses',
    groupType: 'predefined_classifier',
    courseSelector: { classifierKey: 'english' },
    displaySection: 'general',
  });

  return groups;
}

function trackToCatalogYearRules(base: TrackDefinition, year: number): CatalogYearRules {
  const resolved = resolveTrack(base, year);
  return {
    totalCreditsRequired: resolved.totalCreditsRequired,
    semesterSchedule: resolved.semesterSchedule,
    requirementGroups: buildRequirementGroups(resolved),
  };
}

/** Strip undefined values — Firestore rejects them */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// ── Seed tracks ───────────────────────────────────────────────────────────────

async function seedTrack(track: TrackDefinition): Promise<void> {
  const variantYears = Object.keys(track.yearVariants ?? {}).map(Number);
  const availableYears = variantYears.sort((a, b) => b - a);

  const trackRef = db.collection('degreeRules').doc(track.id);

  const meta: FirestoreTrackMeta = {
    id: track.id as TrackId,
    name: track.name,
    description: track.description,
    availableYears,
  };
  await trackRef.set(clean(meta));
  console.log(`  ✓ /degreeRules/${track.id}`);

  // Always store the base (no variant applied) as year key "base"
  const baseRules = trackToCatalogYearRules(track, -1);
  await trackRef.collection('catalogYears').doc('base').set(clean(baseRules));
  console.log(`    ✓ catalogYears/base`);

  // Store each year variant
  for (const year of variantYears) {
    const rules = trackToCatalogYearRules(track, year);
    await trackRef.collection('catalogYears').doc(String(year)).set(clean(rules));
    console.log(`    ✓ catalogYears/${year}`);
  }
}

// ── Seed specializations ──────────────────────────────────────────────────────

async function seedSpecializations(track: TrackDefinition): Promise<void> {
  const folder = TRACK_SPECIALIZATION_FOLDERS[track.id as TrackId];
  if (!folder) return;

  const specializationsDir = path.join(ROOT, 'files', 'קבוצות התמחות', folder);
  let files: string[];
  try {
    files = (await readdir(specializationsDir)).filter((f: string) => f.endsWith('.json'));
  } catch {
    console.warn(`  ⚠ No specializations dir for ${track.id}: ${specializationsDir}`);
    return;
  }

  const trackVariants = track.id === 'cs' ? CS_SPECIALIZATION_YEAR_VARIANTS : {};
  const collRef = db.collection('degreeRules').doc(track.id).collection('specializations');

  for (const file of files) {
    const rawJson = await readFile(path.join(specializationsDir, file), 'utf-8');
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const name = (parsed.specialization_group_name as string | undefined) ?? (parsed.title as string | undefined) ?? file.replace('.json', '');
    const slug = file.replace('.json', '');
    const yearVariants = trackVariants[name] ?? {};

    const fsDoc: FirestoreSpecializationGroup = {
      name,
      ...(parsed.title !== undefined ? { title: parsed.title as string } : {}),
      ...(parsed.type !== undefined ? { type: parsed.type as string } : {}),
      ...(parsed.courses !== undefined ? { courses: parsed.courses as FirestoreSpecializationGroup['courses'] } : {}),
      ...(parsed.requirements !== undefined ? { requirements: parsed.requirements as Record<string, unknown> } : {}),
      ...(parsed.mutual_exclusion_rules !== undefined ? { mutual_exclusion_rules: parsed.mutual_exclusion_rules as FirestoreSpecializationGroup['mutual_exclusion_rules'] } : {}),
      ...(parsed.notes !== undefined ? { notes: parsed.notes as string[] } : {}),
      ...(Object.keys(yearVariants).length > 0 ? { yearVariants } : {}),
    };
    await collRef.doc(slug).set(clean(fsDoc));
    console.log(`    ✓ specializations/${slug}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Seeding /degreeRules collection...\n');

  for (const track of ALL_TRACKS) {
    console.log(`Track: ${track.id} (${track.name})`);
    await seedTrack(track);
    await seedSpecializations(track);
    console.log('');
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
