import { collection, doc, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { TrackId, TrackSpecializationCatalog } from '../types';
import type { CatalogYearRules, FirestoreTrackMeta, FirestoreSpecializationGroup, GlobalCourseSettings } from '../types/firestoreRules';
import { DEFAULT_GLOBAL_COURSE_SETTINGS } from '../types/firestoreRules';
import {
  buildTrackSpecializationCatalogs,
  TRACK_SPECIALIZATION_FOLDERS,
  applySpecializationGroupYearVariant,
} from '../domain/specializations/engine';

// ── Module-level caches (survive component re-renders) ────────────────────────

let allTrackMetaPromise: Promise<FirestoreTrackMeta[]> | null = null;
const catalogYearCache = new Map<string, CatalogYearRules>();
const specializationCache = new Map<string, TrackSpecializationCatalog>();

// ── Track metadata ────────────────────────────────────────────────────────────

/**
 * Fetch all track metadata docs from /degreeRules.
 * Result is cached for the lifetime of the page.
 */
export function fetchAllTrackMeta(): Promise<FirestoreTrackMeta[]> {
  if (allTrackMetaPromise) return allTrackMetaPromise;
  allTrackMetaPromise = getDocs(collection(db, 'degreeRules')).then((snap) =>
    snap.docs.map((d) => d.data() as FirestoreTrackMeta),
  );
  return allTrackMetaPromise;
}

// ── Catalog year rules ────────────────────────────────────────────────────────

/**
 * Fetch requirement rules for a specific track+year.
 * Falls back to the 'base' document if the requested year has no doc.
 * Returns null if neither exists (Firestore not yet seeded).
 */
export async function fetchCatalogYearRules(
  trackId: TrackId,
  year: number | null,
): Promise<CatalogYearRules | null> {
  const yearKey = year ? String(year) : 'base';
  const cacheKey = `${trackId}:${yearKey}`;

  if (catalogYearCache.has(cacheKey)) {
    return catalogYearCache.get(cacheKey)!;
  }

  const yearRef = doc(db, 'degreeRules', trackId, 'catalogYears', yearKey);
  const snap = await getDoc(yearRef);

  if (snap.exists()) {
    const rules = snap.data() as CatalogYearRules;
    catalogYearCache.set(cacheKey, rules);
    return rules;
  }

  // Fall back to base if the specific year isn't found
  if (yearKey !== 'base') {
    const baseRef = doc(db, 'degreeRules', trackId, 'catalogYears', 'base');
    const baseSnap = await getDoc(baseRef);
    if (baseSnap.exists()) {
      const rules = baseSnap.data() as CatalogYearRules;
      catalogYearCache.set(cacheKey, rules);
      return rules;
    }
  }

  return null;
}

// ── Specialization catalog ────────────────────────────────────────────────────

/**
 * Fetch and build the specialization catalog for a track, applying year variants
 * from Firestore (stored on each specialization document).
 * Result is cached per track+year combination.
 */
export async function fetchSpecializationCatalog(
  trackId: TrackId,
  catalogYear?: number | null,
): Promise<TrackSpecializationCatalog> {
  const cacheKey = `${trackId}:${catalogYear ?? 'none'}`;
  if (specializationCache.has(cacheKey)) {
    return specializationCache.get(cacheKey)!;
  }

  // Fetch all specialization documents for this track
  const snap = await getDocs(
    collection(db, 'degreeRules', trackId, 'specializations'),
  );

  const folder = TRACK_SPECIALIZATION_FOLDERS[trackId] ?? trackId;
  const firestoreDocs = snap.docs.map((d) => d.data() as FirestoreSpecializationGroup);

  // Reconstruct JSON strings from structured Firestore fields for the existing parser
  const fileEntries = firestoreDocs.map((fsDoc) => ({
    path: `/files/קבוצות התמחות/${folder}/${fsDoc.name}.json`,
    content: JSON.stringify({
      title: fsDoc.title ?? fsDoc.name,
      specialization_group_name: fsDoc.name,
      type: fsDoc.type ?? 'specialization_group',
      courses: fsDoc.courses ?? [],
      ...(fsDoc.requirements !== undefined ? { requirements: fsDoc.requirements } : {}),
      ...(fsDoc.mutual_exclusion_rules !== undefined ? { mutual_exclusion_rules: fsDoc.mutual_exclusion_rules } : {}),
      ...(fsDoc.notes !== undefined ? { notes: fsDoc.notes } : {}),
    }),
  }));

  // Build the catalog using the existing parser
  const catalogs = buildTrackSpecializationCatalogs({
    [trackId]: fileEntries,
  } as Record<TrackId, { path: string; content: string }[]>);

  let catalog = catalogs[trackId];

  // Apply year variants stored in the Firestore documents
  if (catalogYear && firestoreDocs.length > 0) {
    const variantsByName = new Map(
      firestoreDocs
        .filter((d) => d.yearVariants && String(catalogYear) in (d.yearVariants as Record<string, unknown>))
        .map((d) => [d.name, d.yearVariants![String(catalogYear)]]),
    );

    if (variantsByName.size > 0) {
      catalog = {
        ...catalog,
        groups: catalog.groups.map((group) => {
          const variant = variantsByName.get(group.name);
          if (!variant) return group;
          return applySpecializationGroupYearVariant(group, variant);
        }),
      };
    }
  }

  specializationCache.set(cacheKey, catalog);
  return catalog;
}

/** Clear all caches — call after admin saves changes so the app picks up new data. */
export function clearDegreeRulesCache(): void {
  allTrackMetaPromise = null;
  catalogYearCache.clear();
  specializationCache.clear();
}

// ── Global course settings ────────────────────────────────────────────────────

let globalSettingsPromise: Promise<GlobalCourseSettings> | null = null;

export function fetchGlobalCourseSettings(): Promise<GlobalCourseSettings> {
  if (globalSettingsPromise) return globalSettingsPromise;
  globalSettingsPromise = getDoc(doc(db, 'globalSettings', 'courseClassification')).then((snap) => {
    if (snap.exists()) return snap.data() as GlobalCourseSettings;
    return DEFAULT_GLOBAL_COURSE_SETTINGS;
  }).catch(() => DEFAULT_GLOBAL_COURSE_SETTINGS);
  return globalSettingsPromise;
}

export async function saveGlobalCourseSettings(settings: GlobalCourseSettings): Promise<void> {
  await setDoc(doc(db, 'globalSettings', 'courseClassification'), JSON.parse(JSON.stringify(settings)));
  globalSettingsPromise = Promise.resolve(settings);
}
