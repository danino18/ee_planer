import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";

import { plansRouter } from "./routes/plans";
import { adminRouter } from "./routes/admin";
import { aiRouter } from "./routes/ai";

admin.initializeApp();

const app = express();

// Parse JSON bodies
app.use(express.json());

// CORS — allow only your own domain in production
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Routes
app.use("/plans", plansRouter);
app.use("/admin", adminRouter);
app.use("/ai", aiRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Export as a single Firebase Function named "api"
// All endpoints are under: https://<region>-<project>.cloudfunctions.net/api/...
export const api = functions.onRequest(
  {
    region: "us-central1",
    // Secrets are referenced here so Functions can access them at runtime
    // Uncomment when secrets are set up:
    // secrets: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ADMIN_UIDS"],
  },
  app
);
