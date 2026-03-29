import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

/**
 * Middleware: checks if the authenticated user is an admin.
 * Must be used AFTER verifyAuth.
 *
 * Admin UIDs are stored in the ADMIN_UIDS environment variable as
 * a comma-separated list (set via Firebase Secret Manager or .env).
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const uid = (req as AuthRequest).uid;
  const adminUids = (process.env.ADMIN_UIDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!adminUids.includes(uid)) {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }

  next();
}
