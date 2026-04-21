import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { requireActiveCaregiver } from "../middleware/activeCaregiver.js";
import {
  createPresignedPutUrl,
  sanitizeFileName,
  registrationObjectPrefix,
} from "../lib/s3.js";
import {
  getRegistrationDocumentsForUser,
  saveRegistrationDocuments,
} from "../store/caregiverRegistrationStore.js";

const router = Router();

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = Number(process.env.S3_MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

router.use(requireAuth);
router.use(requireRoles("caregiver"));
router.use(requireActiveCaregiver);

/**
 * Request presigned PUT URLs for direct browser → S3 uploads.
 * Body: { files: [{ documentType, contentType, fileName, fileSize? }] }
 */
router.post("/presign", async (req: AuthedRequest, res) => {
  const body = req.body as {
    files?: {
      documentType?: string;
      contentType?: string;
      fileName?: string;
      fileSize?: number;
    }[];
  };
  const files = body.files;
  if (!Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: "VALIDATION", message: "files[] required" });
    return;
  }
  if (files.length > 12) {
    res.status(400).json({ error: "VALIDATION", message: "Too many files" });
    return;
  }

  const uid = req.userId!;
  const prefix = registrationObjectPrefix(uid);
  const results: {
    documentType: string;
    s3Key: string;
    uploadUrl: string;
    expiresIn: number;
    headers: { ContentType: string };
  }[] = [];

  try {
  for (const f of files) {
    const documentType = (f.documentType ?? "").trim();
    const contentType = (f.contentType ?? "").trim().toLowerCase();
    const fileName = (f.fileName ?? "").trim();
    if (!documentType || !fileName) {
      res.status(400).json({
        error: "VALIDATION",
        message: "Each file needs documentType and fileName",
      });
      return;
    }
    if (!ALLOWED_TYPES.has(contentType)) {
      res.status(400).json({
        error: "VALIDATION",
        message: `Unsupported content type: ${contentType}`,
      });
      return;
    }
    if (typeof f.fileSize === "number" && f.fileSize > MAX_BYTES) {
      res.status(400).json({
        error: "VALIDATION",
        message: `File too large (max ${MAX_BYTES} bytes)`,
      });
      return;
    }

    const safe = sanitizeFileName(fileName);
    const s3Key = `${prefix}/${documentType}/${randomUUID()}-${safe}`;
    const { uploadUrl, expiresIn } = await createPresignedPutUrl({
      key: s3Key,
      contentType,
    });
    results.push({
      documentType,
      s3Key,
      uploadUrl,
      expiresIn,
      headers: { ContentType: contentType },
    });
  }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("S3 is not configured") || msg.includes("S3_BUCKET")) {
      res.status(503).json({
        error: "S3_UNAVAILABLE",
        message:
          "File storage is not configured. Set S3_BUCKET_NAME and AWS_REGION on the API.",
      });
      return;
    }
    throw e;
  }

  res.json({ uploads: results });
});

/**
 * Persist uploaded object keys after client PUTs to S3 using presigned URLs.
 * Body: { documents: [{ documentType, s3Key, contentType, originalFileName }] }
 */
router.post("/documents", async (req: AuthedRequest, res) => {
  const body = req.body as {
    documents?: {
      documentType?: string;
      s3Key?: string;
      contentType?: string;
      originalFileName?: string;
    }[];
  };
  const docs = body.documents;
  if (!Array.isArray(docs) || docs.length === 0) {
    res.status(400).json({ error: "VALIDATION", message: "documents[] required" });
    return;
  }
  try {
    await saveRegistrationDocuments(
      req.userId!,
      docs.map((d) => ({
        documentType: String(d.documentType ?? "").trim(),
        s3Key: String(d.s3Key ?? "").trim(),
        contentType: String(d.contentType ?? "").trim(),
        originalFileName: String(d.originalFileName ?? "").trim(),
      })),
    );
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "VALIDATION") {
      res.status(400).json({
        error: "VALIDATION",
        message: "Each document needs type, key, content type, and file name.",
      });
      return;
    }
    if (e instanceof Error && e.message === "INVALID_KEY") {
      res.status(400).json({
        error: "VALIDATION",
        message: "Invalid storage key for this user",
      });
      return;
    }
    throw e;
  }
});

/** List saved documents with short-lived signed download URLs. */
router.get("/documents", async (req: AuthedRequest, res) => {
  const items = await getRegistrationDocumentsForUser(req.userId!);
  res.json({ documents: items });
});

export default router;
