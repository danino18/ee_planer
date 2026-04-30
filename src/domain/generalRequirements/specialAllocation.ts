import {
  isChoirOrOrchestraCourseId,
  isSportsTeamCourseId,
} from '../../data/generalRequirements/courseClassification';

export interface SpecialEnrichmentAllocationInput {
  choirOrOrchestraCredits: number;
  sportsTeamCredits: number;
}

export interface SpecialEnrichmentAllocation {
  enrichmentRequired: number;
  freeChoiceRequired: number;
  sportRequired: number;
  recognizedChoirOrOrchestraCredits: number;
  recognizedSportsTeamCredits: number;
  recognizedSpecialCredits: number;
  unrecognizedSpecialCredits: number;
}

interface AllocationRow {
  minCredits: number;
  recognizedCredits: number;
  enrichmentRequired: number;
  freeChoiceRequired: number;
  sportRequired: number;
}

const BASE_ALLOCATION: SpecialEnrichmentAllocation = {
  enrichmentRequired: 6,
  freeChoiceRequired: 4,
  sportRequired: 2,
  recognizedChoirOrOrchestraCredits: 0,
  recognizedSportsTeamCredits: 0,
  recognizedSpecialCredits: 0,
  unrecognizedSpecialCredits: 0,
};

const CHOIR_ORCHESTRA_4_YEAR_ROWS: AllocationRow[] = [
  { minCredits: 8, recognizedCredits: 8, enrichmentRequired: 2, freeChoiceRequired: 0, sportRequired: 2 },
  { minCredits: 6, recognizedCredits: 6, enrichmentRequired: 4, freeChoiceRequired: 0, sportRequired: 2 },
  { minCredits: 4, recognizedCredits: 4, enrichmentRequired: 6, freeChoiceRequired: 0, sportRequired: 2 },
  { minCredits: 2, recognizedCredits: 2, enrichmentRequired: 6, freeChoiceRequired: 2, sportRequired: 2 },
];

const SPORTS_TEAM_4_YEAR_ROWS: AllocationRow[] = [
  { minCredits: 9, recognizedCredits: 9, enrichmentRequired: 2, freeChoiceRequired: 1, sportRequired: 0 },
  { minCredits: 7.5, recognizedCredits: 7.5, enrichmentRequired: 4, freeChoiceRequired: 0.5, sportRequired: 0 },
  { minCredits: 6, recognizedCredits: 6, enrichmentRequired: 4, freeChoiceRequired: 2, sportRequired: 0 },
  { minCredits: 4.5, recognizedCredits: 4.5, enrichmentRequired: 6, freeChoiceRequired: 1.5, sportRequired: 0 },
  { minCredits: 3, recognizedCredits: 3, enrichmentRequired: 6, freeChoiceRequired: 3, sportRequired: 0 },
  { minCredits: 1.5, recognizedCredits: 1.5, enrichmentRequired: 6, freeChoiceRequired: 3.5, sportRequired: 1 },
];

function rowForCredits(credits: number, rows: AllocationRow[]): AllocationRow | null {
  return rows.find((row) => credits >= row.minCredits) ?? null;
}

export function calculateSpecialEnrichmentAllocation({
  choirOrOrchestraCredits,
  sportsTeamCredits,
}: SpecialEnrichmentAllocationInput): SpecialEnrichmentAllocation {
  const choirRow = rowForCredits(choirOrOrchestraCredits, CHOIR_ORCHESTRA_4_YEAR_ROWS);
  const sportsTeamRow = rowForCredits(sportsTeamCredits, SPORTS_TEAM_4_YEAR_ROWS);

  const choirAllocation = choirRow
    ? {
        enrichmentRequired: choirRow.enrichmentRequired,
        freeChoiceRequired: choirRow.freeChoiceRequired,
        sportRequired: choirRow.sportRequired,
        recognizedCredits: choirRow.recognizedCredits,
      }
    : {
        enrichmentRequired: BASE_ALLOCATION.enrichmentRequired,
        freeChoiceRequired: BASE_ALLOCATION.freeChoiceRequired,
        sportRequired: BASE_ALLOCATION.sportRequired,
        recognizedCredits: 0,
      };

  const sportsTeamAllocation = sportsTeamRow
    ? {
        enrichmentRequired: sportsTeamRow.enrichmentRequired,
        freeChoiceRequired: sportsTeamRow.freeChoiceRequired,
        sportRequired: sportsTeamRow.sportRequired,
        recognizedCredits: sportsTeamRow.recognizedCredits,
      }
    : {
        enrichmentRequired: BASE_ALLOCATION.enrichmentRequired,
        freeChoiceRequired: BASE_ALLOCATION.freeChoiceRequired,
        sportRequired: BASE_ALLOCATION.sportRequired,
        recognizedCredits: 0,
      };

  const recognizedChoirOrOrchestraCredits = Math.min(
    choirOrOrchestraCredits,
    choirAllocation.recognizedCredits,
  );
  const recognizedSportsTeamCredits = Math.min(
    sportsTeamCredits,
    sportsTeamAllocation.recognizedCredits,
  );
  const recognizedSpecialCredits =
    recognizedChoirOrOrchestraCredits + recognizedSportsTeamCredits;
  const allSpecialCredits = choirOrOrchestraCredits + sportsTeamCredits;

  return {
    enrichmentRequired: Math.min(
      choirAllocation.enrichmentRequired,
      sportsTeamAllocation.enrichmentRequired,
    ),
    freeChoiceRequired: Math.min(
      choirAllocation.freeChoiceRequired,
      sportsTeamAllocation.freeChoiceRequired,
    ),
    sportRequired: Math.min(choirAllocation.sportRequired, sportsTeamAllocation.sportRequired),
    recognizedChoirOrOrchestraCredits,
    recognizedSportsTeamCredits,
    recognizedSpecialCredits,
    unrecognizedSpecialCredits: Math.max(0, allSpecialCredits - recognizedSpecialCredits),
  };
}

export function getSpecialCourseKind(courseId: string): 'choir_or_orchestra' | 'sports_team' | null {
  if (isChoirOrOrchestraCourseId(courseId)) return 'choir_or_orchestra';
  if (isSportsTeamCourseId(courseId)) return 'sports_team';
  return null;
}
