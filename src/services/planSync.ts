import type { PlanVersion, StudentPlan, VersionedPlanEnvelope } from '../types';
import { serializePlanState } from './planStateSerialization';

export interface EnvelopeStateLike extends StudentPlan {
  versions?: PlanVersion[];
  activeVersionId?: string;
}

export interface EnvelopeFreshnessKey {
  latestUpdatedAt: number;
  activeUpdatedAt: number;
  versionCount: number;
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

export function getEnvelopeFreshnessKey(envelope: VersionedPlanEnvelope): EnvelopeFreshnessKey {
  const activeVersion =
    envelope.versions.find((version) => version.id === envelope.activeVersionId) ??
    envelope.versions[0];

  return {
    latestUpdatedAt: envelope.versions.reduce((latest, version) => Math.max(latest, version.updatedAt), 0),
    activeUpdatedAt: activeVersion?.updatedAt ?? 0,
    versionCount: envelope.versions.length,
  };
}

export function compareEnvelopeFreshness(localEnvelope: VersionedPlanEnvelope, cloudEnvelope: VersionedPlanEnvelope): number {
  const localKey = getEnvelopeFreshnessKey(localEnvelope);
  const cloudKey = getEnvelopeFreshnessKey(cloudEnvelope);

  if (localKey.latestUpdatedAt !== cloudKey.latestUpdatedAt) {
    return Math.sign(cloudKey.latestUpdatedAt - localKey.latestUpdatedAt);
  }

  if (localKey.activeUpdatedAt !== cloudKey.activeUpdatedAt) {
    return Math.sign(cloudKey.activeUpdatedAt - localKey.activeUpdatedAt);
  }

  if (localKey.versionCount !== cloudKey.versionCount) {
    return Math.sign(cloudKey.versionCount - localKey.versionCount);
  }

  return 0;
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

  return compareEnvelopeFreshness(localEnvelope, cloudEnvelope) > 0;
}
