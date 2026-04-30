import * as admin from "firebase-admin";
import { randomUUID } from "crypto";

const db = () => admin.firestore();
const COLLECTION = "shares";

export type ShareAccess = "public" | "restricted";
export type SharePermission = "view" | "edit";

export interface ShareDoc {
  id: string;
  ownerUid: string;
  ownerEmail: string | null;
  envelope: Record<string, unknown>;
  access: ShareAccess;
  permission: SharePermission;
  allowedEmails: string[];
  createdAt: number;
  updatedAt: number;
  revoked: boolean;
  expiresAt: number | null;
}

function generateShareId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function createShare(input: {
  ownerUid: string;
  ownerEmail: string | null;
  envelope: Record<string, unknown>;
  access: ShareAccess;
  permission: SharePermission;
  allowedEmails: string[];
  expiresAt: number | null;
}): Promise<ShareDoc> {
  const id = generateShareId();
  const now = Date.now();
  const doc: ShareDoc = {
    id,
    ownerUid: input.ownerUid,
    ownerEmail: input.ownerEmail,
    envelope: input.envelope,
    access: input.access,
    permission: input.permission,
    allowedEmails: input.allowedEmails,
    createdAt: now,
    updatedAt: now,
    revoked: false,
    expiresAt: input.expiresAt,
  };
  await db().collection(COLLECTION).doc(id).set(doc);
  return doc;
}

export async function getShare(shareId: string): Promise<ShareDoc | null> {
  const snap = await db().collection(COLLECTION).doc(shareId).get();
  if (!snap.exists) return null;
  return snap.data() as ShareDoc;
}

export async function updateShareEnvelope(
  shareId: string,
  envelope: Record<string, unknown>
): Promise<void> {
  await db().collection(COLLECTION).doc(shareId).update({
    envelope,
    updatedAt: Date.now(),
  });
}

export async function updateShareMeta(
  shareId: string,
  patch: Partial<Pick<ShareDoc, "access" | "permission" | "allowedEmails" | "revoked">>
): Promise<void> {
  await db().collection(COLLECTION).doc(shareId).update({
    ...patch,
    updatedAt: Date.now(),
  });
}
