import type { NextFunction, Request, RequestHandler, Response } from "express";

interface RateLimitOptions {
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

type OriginRule =
  | { type: "exact"; value: string }
  | { type: "suffix"; value: string };

const rateLimitStore = new Map<string, RateLimitEntry>();
const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function appendVaryHeader(res: Response, value: string): void {
  const existing = res.getHeader("Vary");
  if (typeof existing !== "string" || existing.length === 0) {
    res.setHeader("Vary", value);
    return;
  }

  const currentValues = existing
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (!currentValues.includes(value.toLowerCase())) {
    res.setHeader("Vary", `${existing}, ${value}`);
  }
}

function normalizeOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function getProjectId(): string | null {
  if (process.env.GCLOUD_PROJECT) {
    return process.env.GCLOUD_PROJECT;
  }

  const firebaseConfig = process.env.FIREBASE_CONFIG;
  if (!firebaseConfig) {
    return null;
  }

  try {
    const parsed = JSON.parse(firebaseConfig) as { projectId?: unknown };
    return typeof parsed.projectId === "string" ? parsed.projectId : null;
  } catch {
    return null;
  }
}

function parseOriginRules(): OriginRule[] {
  const rules: OriginRule[] = LOCAL_DEV_ORIGINS.map((origin) => ({
    type: "exact",
    value: origin,
  }));
  const projectId = getProjectId();

  if (projectId) {
    rules.push(
      { type: "exact", value: `https://${projectId}.web.app` },
      { type: "exact", value: `https://${projectId}.firebaseapp.com` }
    );
  }

  // Keep current Vercel deployments working, while ALLOWED_ORIGINS can tighten this further.
  rules.push({ type: "suffix", value: ".vercel.app" });

  const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const origin of configuredOrigins) {
    if (origin.startsWith("https://*.")) {
      rules.push({ type: "suffix", value: `.${origin.slice("https://*.".length)}` });
      continue;
    }

    if (origin.startsWith("http://*.")) {
      rules.push({ type: "suffix", value: `.${origin.slice("http://*.".length)}` });
      continue;
    }

    const normalized = normalizeOrigin(origin);
    if (normalized) {
      rules.push({ type: "exact", value: normalized });
    }
  }

  return rules;
}

function isAllowedOrigin(origin: string): boolean {
  const rules = parseOriginRules();

  return rules.some((rule) => {
    if (rule.type === "exact") {
      return origin === rule.value;
    }

    try {
      const url = new URL(origin);
      return url.hostname.endsWith(rule.value);
    } catch {
      return false;
    }
  });
}

function pruneExpiredRateLimitEntries(now: number): void {
  if (rateLimitStore.size < 5000) {
    return;
  }

  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function getRequesterKey(req: Request, prefix: string): string {
  const maybeUid = (req as Request & { uid?: string }).uid;
  const identity = maybeUid ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
  return `${prefix}:${identity}`;
}

export const securityHeadersMiddleware: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );
  next();
};

export const corsMiddleware: RequestHandler = (req, res, next) => {
  appendVaryHeader(res, "Origin");

  const requestOrigin = req.headers.origin;
  if (!requestOrigin) {
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
    return;
  }

  const normalizedOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedOrigin || !isAllowedOrigin(normalizedOrigin)) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "3600");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
};

export function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  const { keyPrefix, maxRequests, windowMs } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    pruneExpiredRateLimitEntries(now);

    const storeKey = getRequesterKey(req, keyPrefix);
    const existing = rateLimitStore.get(storeKey);

    if (!existing || existing.resetAt <= now) {
      rateLimitStore.set(storeKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    existing.count += 1;
    rateLimitStore.set(storeKey, existing);
    next();
  };
}
