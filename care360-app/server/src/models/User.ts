import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    /** @deprecated Legacy single role — migrated to `roles` on startup. */
    role: {
      type: String,
      enum: ["admin", "caregiver", "client"],
      required: false,
    },
    roles: {
      type: [{ type: String, enum: ["admin", "caregiver", "client"] }],
      required: false,
      default: undefined,
    },
    name: { type: String, required: true, trim: true },
    /**
     * Caregiver approval workflow (ignored for non-caregiver accounts).
     */
    caregiverOnboardingStatus: {
      type: String,
      enum: ["none", "not_applied", "pending", "active", "rejected"],
      default: "none",
    },
  },
  { timestamps: true },
);

export const UserModel =
  mongoose.models.User ?? mongoose.model("User", userSchema);
