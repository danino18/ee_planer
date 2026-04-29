import { Router, Request, Response } from "express";
import { verifyAuth, AuthRequest } from "../middleware/auth";
import { optionalAuth, OptionalAuthRequest } from "../middleware/optionalAuth";
import {
  createShare,
  getShare,
  updateShareEnvelope,
  updateShareMeta,
  ShareAccess,
  SharePermission,
} from "../services/sharesService";
import { createRateLimitMiddleware } from "../security/http";
import { validateStudentPlanPayload } from "../security/planValidation";

export const sharesRouter = Router();

sharesRouter.use(createRateLimitMiddleware({
  keyPrefix: "shares",
  windowMs: 60_000,
  maxRequests: 120,
}));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ALLOWED_EMAILS = 50;

function parseAccess(value: unknown): ShareAccess | null {
  return value === "public" || value === "restricted" ? value : null;
}

function parsePermission(value: unknown): SharePermission | null {
  return value === "view" || value === "edit" ? value : null;
}

function sanitizeEmails(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_ALLOWED_EMAILS) return null;
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") return null;
    const email = raw.trim().toLowerCase();
    if (email.length === 0) continue;
    if (email.length > 254 || !EMAIL_REGEX.test(email)) return null;
    out.push(email);
  }
  return Array.from(new Set(out));
}

// POST /shares — create a new share. Owner must be authenticated.
sharesRouter.post("/", verifyAuth, async (req: Request, res: Response): Promise<void> => {
  const uid = (req as AuthRequest).uid;
  const body = req.body as Record<string, unknown> | null;

  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const access = parseAccess(body.access);
  const permission = parsePermission(body.permission);
  if (!access || !permission) {
    res.status(400).json({ error: "Invalid access/permission" });
    return;
  }

  const allowedEmails = sanitizeEmails(body.allowedEmails ?? []);
  if (allowedEmails === null) {
    res.status(400).json({ error: "Invalid allowedEmails" });
    return;
  }

  if (access === "restricted" && allowedEmails.length === 0) {
    res.status(400).json({ error: "Restricted shares require at least one email" });
    return;
  }

  const validated = validateStudentPlanPayload(body.envelope);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }

  let ownerEmail: string | null = null;
  try {
    const userRecord = await import("firebase-admin").then((m) =>
      m.auth().getUser(uid)
    );
    ownerEmail = userRecord.email?.toLowerCase() ?? null;
  } catch {
    ownerEmail = null;
  }

  try {
    const doc = await createShare({
      ownerUid: uid,
      ownerEmail,
      envelope: validated.value,
      access,
      permission,
      allowedEmails,
    });
    res.json({ shareId: doc.id });
  } catch (err) {
    console.error("POST /shares error:", err);
    res.status(500).json({ error: "Failed to create share" });
  }
});

// GET /shares/:id — fetch a share. Always 200; payload signals state.
sharesRouter.get("/:id", optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || id.length > 64) {
    res.status(400).json({ error: "Invalid share id" });
    return;
  }

  try {
    const share = await getShare(id);
    if (!share) {
      res.json({ ok: false, reason: "not_found" });
      return;
    }

    if (share.revoked) {
      res.json({ ok: false, reason: "revoked" });
      return;
    }

    const { uid, email } = req as OptionalAuthRequest;
    const isOwner = uid !== null && uid === share.ownerUid;

    if (share.access === "restricted" && !isOwner) {
      if (!uid) {
        res.json({ ok: false, reason: "auth_required" });
        return;
      }
      if (!email || !share.allowedEmails.includes(email)) {
        res.json({ ok: false, reason: "forbidden" });
        return;
      }
    }

    const canEdit = share.permission === "edit" || isOwner;
    res.json({ ok: true, share, canEdit });
  } catch (err) {
    console.error("GET /shares/:id error:", err);
    res.status(500).json({ error: "Failed to load share" });
  }
});

// PUT /shares/:id — update envelope. Allowed when share permission is 'edit'
// and caller passes the same access checks as GET; or caller is the owner.
sharesRouter.put("/:id", optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || id.length > 64) {
    res.status(400).json({ error: "Invalid share id" });
    return;
  }

  const body = req.body as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const validated = validateStudentPlanPayload(body.envelope);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }

  try {
    const share = await getShare(id);
    if (!share) {
      res.status(404).json({ error: "Share not found" });
      return;
    }
    if (share.revoked) {
      res.status(410).json({ error: "Share revoked" });
      return;
    }

    const { uid, email } = req as OptionalAuthRequest;
    const isOwner = uid !== null && uid === share.ownerUid;

    if (!isOwner && share.permission !== "edit") {
      res.status(403).json({ error: "Read-only share" });
      return;
    }

    if (!isOwner && share.access === "restricted") {
      if (!uid) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      if (!email || !share.allowedEmails.includes(email)) {
        res.status(403).json({ error: "Email not allowed" });
        return;
      }
    }

    await updateShareEnvelope(id, validated.value);
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /shares/:id error:", err);
    res.status(500).json({ error: "Failed to update share" });
  }
});

// PATCH /shares/:id/meta — owner-only updates (access / permission / revoke).
sharesRouter.patch("/:id/meta", verifyAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || id.length > 64) {
    res.status(400).json({ error: "Invalid share id" });
    return;
  }

  const body = req.body as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  try {
    const share = await getShare(id);
    if (!share) {
      res.status(404).json({ error: "Share not found" });
      return;
    }

    const callerUid = (req as AuthRequest).uid;
    if (callerUid !== share.ownerUid) {
      res.status(403).json({ error: "Not the share owner" });
      return;
    }

    const patch: Record<string, unknown> = {};

    if ("access" in body) {
      const access = parseAccess(body.access);
      if (!access) {
        res.status(400).json({ error: "Invalid access" });
        return;
      }
      patch.access = access;
    }

    if ("permission" in body) {
      const permission = parsePermission(body.permission);
      if (!permission) {
        res.status(400).json({ error: "Invalid permission" });
        return;
      }
      patch.permission = permission;
    }

    if ("allowedEmails" in body) {
      const allowedEmails = sanitizeEmails(body.allowedEmails);
      if (allowedEmails === null) {
        res.status(400).json({ error: "Invalid allowedEmails" });
        return;
      }
      patch.allowedEmails = allowedEmails;
    }

    if ("revoked" in body) {
      if (typeof body.revoked !== "boolean") {
        res.status(400).json({ error: "Invalid revoked" });
        return;
      }
      patch.revoked = body.revoked;
    }

    if (Object.keys(patch).length === 0) {
      res.json({ success: true });
      return;
    }

    await updateShareMeta(id, patch);
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /shares/:id/meta error:", err);
    res.status(500).json({ error: "Failed to update share metadata" });
  }
});
