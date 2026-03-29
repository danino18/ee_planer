import { Router, Request, Response } from "express";
import { verifyAuth } from "../middleware/auth";
import { getAiRecommendations } from "../services/aiService";

export const aiRouter = Router();

// All AI routes require authentication
aiRouter.use(verifyAuth);

/**
 * POST /api/ai/recommend
 * Body: { takenCourseIds: string[], trackId: string }
 *
 * Proxies request to the AI provider using server-side API keys.
 * The client never sees or needs the API key.
 */
aiRouter.post("/recommend", async (req: Request, res: Response): Promise<void> => {
  const { takenCourseIds, trackId } = req.body;

  if (!Array.isArray(takenCourseIds) || typeof trackId !== "string") {
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
