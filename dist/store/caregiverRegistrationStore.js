import mongoose from "mongoose";
import { CaregiverRegistrationModel } from "../models/CaregiverRegistration.js";
import { createPresignedGetUrl, registrationObjectPrefix } from "../lib/s3.js";
export function isKeyOwnedByUser(userId, s3Key) {
    const prefix = `${registrationObjectPrefix(userId)}/`;
    return s3Key.startsWith(prefix);
}
export async function saveRegistrationDocuments(userId, items) {
    const uid = new mongoose.Types.ObjectId(userId);
    for (const item of items) {
        if (!item.documentType?.trim() ||
            !item.s3Key?.trim() ||
            !item.contentType?.trim() ||
            !item.originalFileName?.trim()) {
            throw new Error("VALIDATION");
        }
        if (!isKeyOwnedByUser(userId, item.s3Key)) {
            throw new Error("INVALID_KEY");
        }
    }
    await CaregiverRegistrationModel.findOneAndUpdate({ userId: uid }, {
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
    }, { upsert: true, new: true });
}
export async function getRegistrationDocumentsForUser(userId) {
    const uid = new mongoose.Types.ObjectId(userId);
    const doc = await CaregiverRegistrationModel.findOne({ userId: uid }).lean();
    if (!doc?.documents?.length)
        return [];
    const out = [];
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
