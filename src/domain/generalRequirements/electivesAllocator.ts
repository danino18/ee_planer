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
  const sportFloor: Bucket = { recognized: 0, target: input.allocation.sportRequired };
  const enrichmentFloor: Bucket = { recognized: 0, target: input.allocation.enrichmentRequired };
  const freeChoice: Bucket = { recognized: 0, target: input.allocation.freeChoiceRequired };

  const contributors: GeneralElectivesBreakdown['contributors'] = {
    regularSportToFloor: 0,
    regularSportToFreeChoice: 0,
    melagToFloor: 0,
    melagToFreeChoice: 0,
    externalFacultyToFreeChoice: 0,
    choirRecognized: input.recognizedChoirCredits,
    sportsTeamRecognized: input.recognizedSportsTeamCredits,
    unrecognizedSpecialCredits: input.unrecognizedSpecialCredits,
    surplusBeyond12: 0,
  };

  // Step 1: recognized special credits are pre-routed by the allocation table.
  // The table already reduced sportRequired / enrichmentRequired / freeChoiceRequired
  // so the remaining floors reflect what regular courses still need to fill.
  // The recognized special credits themselves go straight into total (tracked
  // separately) and are NOT poured into the bucket targets that the table
  // already shrank.

  // Step 2: regular sport → sport floor first, overflow → free-choice.
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

  // Step 3: MELAG / humanities free-elective → enrichment floor first, overflow → free-choice.
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

  // Step 4: external-faculty electives → free-choice only.
  remaining = input.externalFacultyCredits;
  {
    const { used, remainder } = pourInto(freeChoice, remaining);
    contributors.externalFacultyToFreeChoice = used;
    contributors.surplusBeyond12 += remainder;
  }

  const recognizedFromBuckets = sportFloor.recognized + enrichmentFloor.recognized + freeChoice.recognized;
  const recognizedSpecial = input.recognizedChoirCredits + input.recognizedSportsTeamCredits;
  const totalRecognized = Math.min(input.generalCreditsTarget, recognizedFromBuckets + recognizedSpecial);

  return {
    total: { recognized: totalRecognized, target: input.generalCreditsTarget },
    sportFloor,
    enrichmentFloor,
    freeChoice,
    contributors,
  };
}
