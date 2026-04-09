import { Router, Request, Response } from "express";
import { verifyAuth } from "../middleware/auth";
import { getAiRecommendations } from "../services/aiService";
import { createRateLimitMiddleware } from "../security/http";

export const aiRouter = Router();

aiRouter.use(verifyAuth);
aiRouter.use(createRateLimitMiddleware({ keyPrefix: "ai", windowMs: 60_000, maxRequests: 15 }));

aiRouter.post("/recommend", async (req: Request, res: Response): Promise<void> => {
  const { takenCourseIds, trackId } = req.body;

  if (
    !Array.isArray(takenCourseIds) ||
    takenCourseIds.length > 600 ||
    takenCourseIds.some((courseId) => typeof courseId !== "string" || courseId.length === 0 || courseId.length > 32) ||
    typeof trackId !== "string" ||
    trackId.length === 0 ||
    trackId.length > 32
  ) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const result = await getAiRecommendations({ takenCourseIds, trackId });
    res.json(result);
  } catch (err) {
    console.error("POST /ai/recommend error:", err);
    res.status(500).json({ error: "AI recommendation failed" });
  }
});
