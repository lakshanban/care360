import mongoose from "mongoose";
import { CaregiverRegistrationModel } from "../models/CaregiverRegistration.js";
import { createPresignedGetUrl, registrationObjectPrefix } from "../lib/s3.js";

export type RegistrationDocumentInput = {
  documentType: string;
  s3Key: string;
  contentType: string;
  originalFileName: string;
};

export function isKeyOwnedByUser(userId: string, s3Key: string): boolean {
  const prefix = `${registrationObjectPrefix(userId)}/`;
  return s3Key.startsWith(prefix);
}

export async function saveRegistrationDocuments(
  userId: string,
  items: RegistrationDocumentInput[],
): Promise<void> {
  const uid = new mongoose.Types.ObjectId(userId);
  for (const item of items) {
    if (
      !item.documentType?.trim() ||
      !item.s3Key?.trim() ||
      !item.contentType?.trim() ||
      !item.originalFileName?.trim()
    ) {
      throw new Error("VALIDATION");
    }
    if (!isKeyOwnedByUser(userId, item.s3Key)) {
      throw new Error("INVALID_KEY");
    }
  }
  await CaregiverRegistrationModel.findOneAndUpdate(
    { userId: uid },
    {
      $set: {
        userId: uid,
        documents: items.map((d) => ({
          documentType: d.documentType,
          s3Key: d.s3Key,
          contentType: d.contentType,
          originalFileName: d.originalFileName,
          uploadedAt: new Date(),
        })),
      },
    },
    { upsert: true, new: true },
  );
}

export type RegistrationDocumentWithUrl = {
  documentType: string;
  s3Key: string;
  contentType: string;
  originalFileName: string;
  uploadedAt: string;
  /** Short-lived signed URL to download the object. */
  downloadUrl: string;
};

export async function getRegistrationDocumentsForUser(
  userId: string,
): Promise<RegistrationDocumentWithUrl[]> {
  const uid = new mongoose.Types.ObjectId(userId);
  const doc = await CaregiverRegistrationModel.findOne({ userId: uid }).lean<{
    documents?: {
      documentType: string;
      s3Key: string;
      contentType: string;
      originalFileName: string;
      uploadedAt?: Date;
    }[];
  } | null>();
  if (!doc?.documents?.length) return [];
  const out: RegistrationDocumentWithUrl[] = [];
  for (const d of doc.documents) {
    const downloadUrl = await createPresignedGetUrl(d.s3Key);
    out.push({
      documentType: d.documentType,
      s3Key: d.s3Key,
      contentType: d.contentType,
      originalFileName: d.originalFileName,
      uploadedAt: (d.uploadedAt ?? new Date()).toISOString(),
      downloadUrl,
    });
  }
  return out;
}
