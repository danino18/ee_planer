import type { SapCourse } from '../types';
import { buildOrderedPlacedCourseIds } from './noAdditionalCredit';

/**
 * "מכיל" (containing course) credit substitution.
 *
 * When a student took a course Y that CONTAINS another course X (per SAP's
 * "מקצועות ללא זיכוי נוסף (מוכלים)" field) and X is a mandatory course in the
 * track, Y fills X's mandatory slot. The mandatory credit counted is capped at
 * X's credits; Y's excess credits (Y.credits − X.credits) flow to free choice.
 *
 * This generalizes the hardcoded `useDefaultCreditsForMandatory` alternative
 * groups in the track definitions, driven automatically by SAP data.
 */
export interface ContainingSubstitution {
  containingCourseId: string;   // Y — the course the student took
  containedCourseId: string;    // X — the mandatory slot it fills
  mandatoryCredits: number;     // min(X.credits, Y.credits)
  excessCredits: number;        // max(0, Y.credits − X.credits) → free choice
}

export interface ContainingInput {
  completedCourses: string[];
  semesters: Record<number, string[]>;
  semesterOrder: number[];
  /** Visible scheduled mandatory course IDs (after any track mutations). */
  mandatoryIds: ReadonlySet<string>;
  /** All placed course IDs (completed + planned). */
  placedIds: ReadonlySet<string>;
  /** Courses that lost their credit in the "no additional credit" pass — must run first. */
  noAdditionalCreditCourseIds: ReadonlySet<string>;
}

export function computeContainingSubstitutions(
  courses: Map<string, SapCourse>,
  input: ContainingInput,
): ContainingSubstitution[] {
  const { mandatoryIds, placedIds, noAdditionalCreditCourseIds } = input;
  const result: ContainingSubstitution[] = [];
  const claimedX = new Set<string>();   // each mandatory X is filled at most once
  const usedY = new Set<string>();      // each container Y donates to at most one slot

  for (const containingCourseId of buildOrderedPlacedCourseIds(input)) {
    if (!placedIds.has(containingCourseId)) continue;
    if (mandatoryIds.has(containingCourseId)) continue;          // Y is itself mandatory — already counted
    if (noAdditionalCreditCourseIds.has(containingCourseId)) continue; // Y lost its credit in the NAC pass
    if (usedY.has(containingCourseId)) continue;

    const containing = courses.get(containingCourseId);
    if (!containing) continue;

    for (const containedCourseId of containing.containedCourseIds ?? []) {
      if (!mandatoryIds.has(containedCourseId)) continue;
      if (claimedX.has(containedCourseId)) continue;
      // X must NOT already contribute its mandatory credit: either it is unplaced,
      // or it is placed but lost its credit in the NAC pass (Y survived the conflict).
      if (placedIds.has(containedCourseId) && !noAdditionalCreditCourseIds.has(containedCourseId)) {
        continue;
      }

      const contained = courses.get(containedCourseId);
      if (!contained) continue;

      const mandatoryCredits = Math.min(contained.credits, containing.credits);
      result.push({
        containingCourseId,
        containedCourseId,
        mandatoryCredits,
        excessCredits: Math.max(0, containing.credits - contained.credits),
      });
      claimedX.add(containedCourseId);
      usedY.add(containingCourseId);
      break; // a container fills a single mandatory slot only
    }
  }

  return result;
}

export function buildContainingMaps(subs: ContainingSubstitution[]): {
  mandatoryCreditByContainer: Map<string, number>;
  filledMandatoryIds: Set<string>;
} {
  const mandatoryCreditByContainer = new Map<string, number>();
  const filledMandatoryIds = new Set<string>();
  for (const sub of subs) {
    mandatoryCreditByContainer.set(sub.containingCourseId, sub.mandatoryCredits);
    filledMandatoryIds.add(sub.containedCourseId);
  }
  return { mandatoryCreditByContainer, filledMandatoryIds };
}
