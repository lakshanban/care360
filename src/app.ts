import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import caregiverRoutes from "./routes/caregiver.js";
import caregiverRegistrationRoutes from "./routes/caregiverRegistration.js";
import clientRoutes from "./routes/client.js";
import publicRoutes from "./routes/public.js";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
dotenv.config({ path: path.join(backendRoot, ".env") });

let hasInitialized = false;

export async function initializeBackend(): Promise<void> {
  if (hasInitialized) {
    return;
  }
  // Milestone UI mode: backend starts without any DB connection.
  hasInitialized = true;
}

export function createApp(): express.Express {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "care360-api", database: "disabled" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/caregiver/registration", caregiverRegistrationRoutes);
  app.use("/api/caregiver", caregiverRoutes);
  app.use("/api/client", clientRoutes);
  app.use("/api/admin", adminRoutes);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(err);
      res.status(500).json({ error: "INTERNAL", message: err.message });
    },
  );

  return app;
}
