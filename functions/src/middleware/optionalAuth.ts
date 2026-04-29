import { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";

export interface OptionalAuthRequest extends Request {
  uid: string | null;
  email: string | null;
}

/**
 * Verifies Firebase ID token if present. Unlike verifyAuth, this does not 401
 * when the header is missing — it sets uid/email to null and continues. Routes
 * that need to differentiate public vs authenticated callers can read req.uid
 * and req.email after this middleware runs.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const reqWithAuth = req as OptionalAuthRequest;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reqWithAuth.uid = null;
    reqWithAuth.email = null;
    next();
    return;
  }

  const idToken = authHeader.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    reqWithAuth.uid = decoded.uid;
    reqWithAuth.email = typeof decoded.email === "string" ? decoded.email.toLowerCase() : null;
  } catch {
    reqWithAuth.uid = null;
    reqWithAuth.email = null;
  }
  next();
}
