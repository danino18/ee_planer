import type { PlanVersion, StudentPlan, VersionedPlanEnvelope } from '../types';
import { serializePlanState } from './planStateSerialization';

export interface EnvelopeStateLike extends StudentPlan {
  versions?: PlanVersion[];
  activeVersionId?: string;
}

interface BuildEnvelopeOptions {
  activeVersionUpdatedAt?: number;
}

function buildFallbackVersion(state: EnvelopeStateLike, now: number, options?: BuildEnvelopeOptions): PlanVersion {
  const versionId = state.activeVersionId || 'default-version';
  return {
    id: versionId,
    name: 'גרסה 1',
    plan: serializePlanState(state),
    createdAt: now,
    updatedAt: options?.activeVersionUpdatedAt ?? now,
  };
}

export function buildEnvelopeFromState(
  state: EnvelopeStateLike,
  options?: BuildEnvelopeOptions,
): VersionedPlanEnvelope {
  const now = Date.now();
  const currentPlan = serializePlanState(state);
  const versions = (state.versions ?? []).map((version) =>
    version.id === state.activeVersionId
      ? { ...version, plan: currentPlan, updatedAt: options?.activeVersionUpdatedAt ?? version.updatedAt }
      : version,
  );

  if (versions.length === 0 || !state.activeVersionId) {
    const fallbackVersion = buildFallbackVersion(state, now, options);
    return {
      schemaVersion: 2,
      versions: [fallbackVersion],
      activeVersionId: fallbackVersion.id,
    };
  }

  return {
    schemaVersion: 2,
    versions,
    activeVersionId: state.activeVersionId,
  };
}

export function getPlanSignature(envelope: VersionedPlanEnvelope): string {
  return JSON.stringify(envelope);
}

export function shouldApplyCloudEnvelope(
  localEnvelope: VersionedPlanEnvelope,
  cloudEnvelope: VersionedPlanEnvelope,
  hasPendingLocalChanges: boolean,
): boolean {
  if (getPlanSignature(localEnvelope) === getPlanSignature(cloudEnvelope)) {
    return false;
  }

  if (hasPendingLocalChanges) {
    return false;
  }

  // No pending local edits → cloud always wins. Freshness comparison is unsafe
  // because a fresh device builds a fallback envelope with updatedAt: Date.now(),
  // which falsely appears newer than real cloud data.
  return true;
}
