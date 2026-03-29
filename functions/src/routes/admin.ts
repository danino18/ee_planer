import { Router, Request, Response } from "express";
import { verifyAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/adminCheck";
import { listAllUsers, deleteUser, getStats, getPlan } from "../services/firestoreService";

export const adminRouter = Router();

// All admin routes require authentication AND admin role
adminRouter.use(verifyAuth);
adminRouter.use(requireAdmin);

// GET /api/admin/stats — total users, plans, etc.
adminRouter.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    console.error("GET /admin/stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /api/admin/users — list all registered users
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

// GET /api/admin/plans/:uid — view any user's plan
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

// DELETE /api/admin/users/:uid — remove user + their data
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
