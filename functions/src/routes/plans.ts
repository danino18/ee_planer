import { Router, Request, Response } from "express";
import { verifyAuth, AuthRequest } from "../middleware/auth";
import { getPlan, savePlan } from "../services/firestoreService";

export const plansRouter = Router();

// Apply auth middleware to all plan routes
plansRouter.use(verifyAuth);

// GET /api/plans — load the authenticated user's plan
plansRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  const uid = (req as AuthRequest).uid;
  try {
    const plan = await getPlan(uid);
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    res.json(plan);
  } catch (err) {
    console.error("GET /plans error:", err);
    res.status(500).json({ error: "Failed to load plan" });
  }
});

// POST /api/plans — save (upsert) the authenticated user's plan
plansRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const uid = (req as AuthRequest).uid;
  const plan = req.body;

  if (!plan || typeof plan !== "object") {
    res.status(400).json({ error: "Invalid plan payload" });
    return;
  }

  try {
    await savePlan(uid, plan);
    res.json({ success: true });
  } catch (err) {
    console.error("POST /plans error:", err);
    res.status(500).json({ error: "Failed to save plan" });
  }
});
