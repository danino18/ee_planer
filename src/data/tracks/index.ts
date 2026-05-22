import type { TrackDefinition, TrackId } from '../../types';
import { eeTrack } from './ee';
import { csTrack } from './cs';
import { eeMathTrack } from './ee_math';
import { eePhysicsTrack } from './ee_physics';
import { eeCombinedTrack } from './ee_combined';
import { ceTrack } from './ce';

const TRACK_MAP: Record<TrackId, TrackDefinition> = {
  ee: eeTrack,
  cs: csTrack,
  ee_math: eeMathTrack,
  ee_physics: eePhysicsTrack,
  ee_combined: eeCombinedTrack,
  ce: ceTrack,
};

export function getTrackDefinition(trackId: TrackId | null | undefined): TrackDefinition | undefined {
  if (!trackId) return undefined;
  return TRACK_MAP[trackId];
}
