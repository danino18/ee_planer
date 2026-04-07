/**
 * AI Service — server-side proxy for AI API calls.
 *
 * API keys (OPENAI_API_KEY / ANTHROPIC_API_KEY) are stored as
 * Firebase Secrets and NEVER sent to the client.
 *
 * To add a key:
 *   firebase functions:secrets:set OPENAI_API_KEY
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 *
 * Then uncomment the `secrets` array in functions/src/index.ts.
 */

export interface AiRecommendationRequest {
  takenCourseIds: string[];
  trackId: string;
}

export interface AiRecommendationResponse {
  recommendations: string[];
  reasoning: string;
}

/**
 * Placeholder: returns static recommendations until an AI provider is configured.
 * Replace with real OpenAI / Anthropic SDK calls when keys are set up.
 */
export async function getAiRecommendations(
  req: AiRecommendationRequest
): Promise<AiRecommendationResponse> {
  void req;
  // TODO: Replace with actual AI call, e.g.:
  //
  // import OpenAI from "openai";
  // const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // const response = await client.chat.completions.create({ ... });
  //
  // OR:
  //
  // import Anthropic from "@anthropic-ai/sdk";
  // const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // const message = await client.messages.create({ ... });

  return {
    recommendations: [],
    reasoning: "AI provider not yet configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.",
  };
}
