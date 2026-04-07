import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";

import { plansRouter } from "./routes/plans";
import { adminRouter } from "./routes/admin";
import { aiRouter } from "./routes/ai";

admin.initializeApp();

const app = express();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getFirebaseConfigProjectId(): string | null {
  const rawConfig = process.env.FIREBASE_CONFIG;
  if (!rawConfig) return null;

  try {
    const parsed: unknown = JSON.parse(rawConfig);
    if (isRecord(parsed) && typeof parsed.projectId === "string") {
      return parsed.projectId;
    }
  } catch {
    return null;
  }

  return null;
}

function getAllowedOrigins(): Set<string> {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? getFirebaseConfigProjectId();
  const defaults = ["http://localhost:5173", "http://127.0.0.1:5173"];

  if (projectId) {
    defaults.push(`https://${projectId}.web.app`, `https://${projectId}.firebaseapp.com`);
  }

  return new Set([...defaults, ...configured]);
}

// Parse JSON bodies
app.use(express.json());

// CORS — allow only your own domain in production
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  const isAllowedOrigin = origin ? allowedOrigins.has(origin) : true;

  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (origin && isAllowedOrigin) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  if (req.method === "OPTIONS") {
    res.sendStatus(isAllowedOrigin ? 204 : 403);
    return;
  }

  if (!isAllowedOrigin) {
    res.status(403).json({ error: "Origin not allowed" });
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
