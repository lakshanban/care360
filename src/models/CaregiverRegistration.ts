import mongoose, { Schema } from "mongoose";

const registrationDocumentSchema = new Schema(
  {
    documentType: {
      type: String,
      required: true,
      trim: true,
    },
    /** Full S3 object key (private bucket). */
    s3Key: { type: String, required: true, trim: true },
    contentType: { type: String, required: true, trim: true },
    originalFileName: { type: String, required: true, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const caregiverRegistrationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    documents: [registrationDocumentSchema],
  },
  { timestamps: true },
);

export const CaregiverRegistrationModel =
  mongoose.models.CaregiverRegistration ??
  mongoose.model("CaregiverRegistration", caregiverRegistrationSchema);
