import { Router, Request, Response } from "express";
import { verifyAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/adminCheck";
import { listAllUsers, deleteUser, getStats, getPlan } from "../services/firestoreService";
import { createRateLimitMiddleware } from "../security/http";

export const adminRouter = Router();

adminRouter.use(verifyAuth);
adminRouter.use(createRateLimitMiddleware({ keyPrefix: "admin", windowMs: 60_000, maxRequests: 60 }));
adminRouter.use(requireAdmin);

adminRouter.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    console.error("GET /admin/stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

adminRouter.get("/users", async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await listAllUsers();
    const safeUsers = users.map((u) => ({
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      creationTime: u.metadata.creationTime,
      lastSignInTime: u.metadata.lastSignInTime,
      disabled: u.disabled,
    }));
    res.json(safeUsers);
  } catch (err) {
    console.error("GET /admin/users error:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

adminRouter.get("/plans/:uid", async (req: Request, res: Response): Promise<void> => {
  const { uid } = req.params;
  try {
    const plan = await getPlan(uid);
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    res.json(plan);
  } catch (err) {
    console.error("GET /admin/plans/:uid error:", err);
    res.status(500).json({ error: "Failed to fetch plan" });
  }
});

adminRouter.delete("/users/:uid", async (req: Request, res: Response): Promise<void> => {
  const { uid } = req.params;
  try {
    await deleteUser(uid);
    res.json({ success: true, deleted: uid });
  } catch (err) {
    console.error("DELETE /admin/users/:uid error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});
