import { Router, Request, Response } from "express";
import { verifyAuth, AuthRequest } from "../middleware/auth";
import { getPlan, savePlan } from "../services/firestoreService";
import { createRateLimitMiddleware } from "../security/http";
import { validateStudentPlanPayload } from "../security/planValidation";

export const plansRouter = Router();

plansRouter.use(verifyAuth);
plansRouter.use(createRateLimitMiddleware({ keyPrefix: "plans", windowMs: 60_000, maxRequests: 120 }));

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

plansRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const uid = (req as AuthRequest).uid;
  const plan = req.body;

  if (!plan || typeof plan !== "object") {
    res.status(400).json({ error: "Invalid plan payload" });
    return;
  }

  const validatedPlan = validateStudentPlanPayload(plan);
  if (!validatedPlan.ok) {
    res.status(400).json({ error: validatedPlan.error });
    return;
  }

  try {
    await savePlan(uid, validatedPlan.value);
    res.json({ success: true });
  } catch (err) {
    console.error("POST /plans error:", err);
    res.status(500).json({ error: "Failed to save plan" });
  }
});
