import { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";

// Extend Express Request to carry the verified uid
export interface AuthRequest extends Request {
  uid: string;
}

/**
 * Middleware: verifies the Firebase ID token from the Authorization header.
 * Attaches req.uid on success, returns 401 on failure.
 */
export async function verifyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const idToken = authHeader.slice(7);

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    (req as AuthRequest).uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
