import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { apiClient } from './apiClient';
import { db } from './firebase';
import { sanitizeEnvelope } from './planValidation';
import type {
  CreateSharePayload,
  CreateShareResponse,
  GetShareResponse,
  ShareAccess,
  SharePermission,
} from '../types/share';
import type { VersionedPlanEnvelope } from '../types';

export interface ShareSnapshot {
  shareId: string;
  envelope: VersionedPlanEnvelope;
  ownerUid: string;
  updatedAt: number;
  revoked: boolean;
  expiresAt: number | null;
}

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

function parseShareDoc(shareId: string, data: DocumentData | undefined): ShareSnapshot | null {
  if (!data) return null;
  const envelope = sanitizeEnvelope(data.envelope);
  if (!envelope) return null;
  if (typeof data.ownerUid !== 'string') return null;
  return {
    shareId,
    envelope,
    ownerUid: data.ownerUid,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    revoked: data.revoked === true,
    expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : null,
  };
}

/**
 * Real-time listener on a single share. Reads are gated by Firestore rules
 * (see firestore.rules → shares/{shareId}); the initial access decision is
 * still performed by the REST GET endpoint so that auth_required / forbidden
 * states get a clear error UI before we open this listener.
 */
export function subscribeToShare(
  shareId: string,
  onData: (snapshot: ShareSnapshot) => void,
  onError?: (error: Error) => void,
): () => void {
  const ref = doc(db, 'shares', shareId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onError?.(new Error('Share not found'));
        return;
      }
      const parsed = parseShareDoc(shareId, snap.data());
      if (!parsed) {
        onError?.(new Error('Invalid share payload'));
        return;
      }
      onData(parsed);
    },
    (error) => {
      onError?.(error);
    },
  );
}

/**
 * Real-time listener on all shares owned by the given user. Used by the
 * regular owner screen to surface "there are pending updates from a
 * collaborator" hints, without auto-applying them.
 */
export function subscribeToMyShares(
  uid: string,
  onData: (shares: ShareSnapshot[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, 'shares'), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snap: QuerySnapshot) => {
      const out: ShareSnapshot[] = [];
      snap.forEach((d) => {
        const parsed = parseShareDoc(d.id, d.data());
        if (parsed && !parsed.revoked) {
          if (parsed.expiresAt !== null && Date.now() > parsed.expiresAt) return;
          out.push(parsed);
        }
      });
      onData(out);
    },
    (error) => {
      onError?.(error);
    },
  );
}
