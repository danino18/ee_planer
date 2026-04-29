import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";

import { plansRouter } from "./routes/plans";
import { adminRouter } from "./routes/admin";
import { aiRouter } from "./routes/ai";
import { sharesRouter } from "./routes/shares";
import { corsMiddleware, securityHeadersMiddleware } from "./security/http";

admin.initializeApp();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

app.use(express.json({ limit: "256kb" }));
app.use(securityHeadersMiddleware);
app.use(corsMiddleware);

app.use("/plans", plansRouter);
app.use("/admin", adminRouter);
app.use("/ai", aiRouter);
app.use("/shares", sharesRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export const api = functions.onRequest(
  {
    region: "us-central1",
    // Uncomment when secrets are configured:
    // secrets: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ADMIN_UIDS"],
  },
  app
);
