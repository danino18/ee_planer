import type { VersionedPlanEnvelope } from './index';

export type ShareAccess = 'public' | 'restricted';
export type SharePermission = 'view' | 'edit';

export interface ShareDoc {
  id: string;
  ownerUid: string;
  ownerEmail: string | null;
  envelope: VersionedPlanEnvelope;
  access: ShareAccess;
  permission: SharePermission;
  allowedEmails: string[];
  createdAt: number;
  updatedAt: number;
  revoked: boolean;
}

export interface CreateSharePayload {
  envelope: VersionedPlanEnvelope;
  access: ShareAccess;
  permission: SharePermission;
  allowedEmails: string[];
}

export interface CreateShareResponse {
  shareId: string;
}

export type GetShareResponse =
  | { ok: true; share: ShareDoc; canEdit: boolean }
  | { ok: false; reason: 'not_found' | 'revoked' | 'auth_required' | 'forbidden' };
