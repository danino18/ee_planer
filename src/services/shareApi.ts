import { apiClient } from './apiClient';
import type {
  CreateSharePayload,
  CreateShareResponse,
  GetShareResponse,
  ShareAccess,
  SharePermission,
} from '../types/share';
import type { VersionedPlanEnvelope } from '../types';

export async function createShare(payload: CreateSharePayload): Promise<CreateShareResponse> {
  return apiClient.post<CreateShareResponse>('/shares', {
    ...payload,
    expiresAt: payload.expiresAt ?? null,
  });
}

export async function fetchShare(shareId: string): Promise<GetShareResponse> {
  return apiClient.getPublic<GetShareResponse>(`/shares/${encodeURIComponent(shareId)}`);
}

export async function updateSharedEnvelope(
  shareId: string,
  envelope: VersionedPlanEnvelope,
): Promise<void> {
  await apiClient.putPublic<{ success: true }>(
    `/shares/${encodeURIComponent(shareId)}`,
    { envelope },
  );
}

export async function updateShareMeta(
  shareId: string,
  patch: Partial<{
    access: ShareAccess;
    permission: SharePermission;
    allowedEmails: string[];
    revoked: boolean;
  }>,
): Promise<void> {
  await apiClient.patch<{ success: true }>(
    `/shares/${encodeURIComponent(shareId)}/meta`,
    patch,
  );
}

export function buildShareUrl(shareId: string): string {
  if (typeof window === 'undefined') return `/#/share/${shareId}`;
  return `${window.location.origin}/#/share/${shareId}`;
}
