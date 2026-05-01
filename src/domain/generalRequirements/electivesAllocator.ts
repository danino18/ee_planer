import type { GeneralElectivesBreakdown } from './types';
import type { SpecialEnrichmentAllocation } from './specialAllocation';

export interface AllocatorInput {
  regularSportCredits: number;
  melagCredits: number;
  externalFacultyCredits: number;
  recognizedChoirCredits: number;
  recognizedSportsTeamCredits: number;
  unrecognizedSpecialCredits: number;
  allocation: SpecialEnrichmentAllocation;
  generalCreditsTarget: number;
}

const BASE_SPORT_FLOOR = 2;
const BASE_ENRICHMENT_FLOOR = 6;
const BASE_FREE_CHOICE = 4;

interface Bucket {
  recognized: number;
  target: number;
}

function pourInto(bucket: Bucket, amount: number): { used: number; remainder: number } {
  if (amount <= 0) return { used: 0, remainder: 0 };
  const room = Math.max(0, bucket.target - bucket.recognized);
  const used = Math.min(amount, room);
  bucket.recognized += used;
  return { used, remainder: amount - used };
}

export function allocateGeneralElectives(input: AllocatorInput): GeneralElectivesBreakdown {
  const allocation = input.allocation;

  // The combined allocation table reduces each "*Required" floor by however much
  // the recognized special credits already filled it. Pre-fill the buckets with
  // those reductions so further regular-source pours respect the remaining room.
  const sportPrefill = Math.max(0, BASE_SPORT_FLOOR - allocation.sportRequired);
  const enrichmentPrefill = Math.max(0, BASE_ENRICHMENT_FLOOR - allocation.enrichmentRequired);
  const freeChoicePrefill = Math.max(0, BASE_FREE_CHOICE - allocation.freeChoiceRequired);

  const sportFloor: Bucket = { recognized: sportPrefill, target: BASE_SPORT_FLOOR };
  const enrichmentFloor: Bucket = { recognized: enrichmentPrefill, target: BASE_ENRICHMENT_FLOOR };
  const freeChoice: Bucket = { recognized: freeChoicePrefill, target: BASE_FREE_CHOICE };

  // Per-source attribution for the disclosure. Each source table has its own
  // reductions; when both choir and sports-team are present they overlap, but
  // the per-table figures still tell the student what each table contributed.
  const choirToEnrichmentFloor = Math.max(
    0,
    BASE_ENRICHMENT_FLOOR - allocation.choirAllocation.enrichmentRequired,
  );
  const choirToFreeChoice = Math.max(
    0,
    BASE_FREE_CHOICE - allocation.choirAllocation.freeChoiceRequired,
  );
  const sportsTeamToSportFloor = Math.max(
    0,
    BASE_SPORT_FLOOR - allocation.sportsTeamAllocation.sportRequired,
  );
  const sportsTeamToEnrichmentFloor = Math.max(
    0,
    BASE_ENRICHMENT_FLOOR - allocation.sportsTeamAllocation.enrichmentRequired,
  );
  const sportsTeamToFreeChoice = Math.max(
    0,
    BASE_FREE_CHOICE - allocation.sportsTeamAllocation.freeChoiceRequired,
  );

  const contributors: GeneralElectivesBreakdown['contributors'] = {
    regularSportToFloor: 0,
    regularSportToFreeChoice: 0,
    melagToFloor: 0,
    melagToFreeChoice: 0,
    externalFacultyToFreeChoice: 0,
    choirRecognized: input.recognizedChoirCredits,
    sportsTeamRecognized: input.recognizedSportsTeamCredits,
    choirToEnrichmentFloor,
    choirToFreeChoice,
    sportsTeamToSportFloor,
    sportsTeamToEnrichmentFloor,
    sportsTeamToFreeChoice,
    unrecognizedSpecialCredits: input.unrecognizedSpecialCredits,
    surplusBeyond12: 0,
  };

  // Regular sport → sport floor, overflow → free-choice, then surplus.
  let remaining = input.regularSportCredits;
  {
    const { used, remainder } = pourInto(sportFloor, remaining);
    contributors.regularSportToFloor = used;
    remaining = remainder;
  }
  {
    const { used, remainder } = pourInto(freeChoice, remaining);
    contributors.regularSportToFreeChoice = used;
    contributors.surplusBeyond12 += remainder;
  }

  // MELAG / humanities free-elective → enrichment floor, overflow → free-choice.
  remaining = input.melagCredits;
  {
    const { used, remainder } = pourInto(enrichmentFloor, remaining);
    contributors.melagToFloor = used;
    remaining = remainder;
  }
  {
    const { used, remainder } = pourInto(freeChoice, remaining);
    contributors.melagToFreeChoice = used;
    contributors.surplusBeyond12 += remainder;
  }

  // External-faculty electives → free-choice only.
  remaining = input.externalFacultyCredits;
  {
    const { used, remainder } = pourInto(freeChoice, remaining);
    contributors.externalFacultyToFreeChoice = used;
    contributors.surplusBeyond12 += remainder;
  }

  const recognizedFromBuckets =
    sportFloor.recognized + enrichmentFloor.recognized + freeChoice.recognized;
  const totalRecognized = Math.min(input.generalCreditsTarget, recognizedFromBuckets);

  return {
    total: { recognized: totalRecognized, target: input.generalCreditsTarget },
    sportFloor,
    enrichmentFloor,
    freeChoice,
    contributors,
  };
}
