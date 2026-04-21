import { onRequest } from "firebase-functions/v2/https";
import { createApp, initializeBackend } from "./app.js";

const app = createApp();

export const api = onRequest(
  { region: process.env.FUNCTION_REGION ?? "us-central1" },
  async (req, res) => {
    await initializeBackend();
    app(req, res);
  },
);
