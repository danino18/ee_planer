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
const apiRouter = express.Router();

app.use(express.json({ limit: "256kb" }));
app.use(securityHeadersMiddleware);
app.use(corsMiddleware);

apiRouter.use("/plans", plansRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/shares", sharesRouter);

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(apiRouter);
app.use("/api", apiRouter);

export const api = functions.onRequest(
  {
    region: "us-central1",
    invoker: "public",
    // Uncomment when secrets are configured:
    // secrets: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ADMIN_UIDS"],
  },
  app
);
