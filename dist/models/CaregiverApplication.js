import mongoose, { Schema } from "mongoose";
const caregiverApplicationSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    nationalId: { type: String, required: true, trim: true },
    skills: [{ type: String, trim: true }],
    experience: { type: String, required: true, trim: true },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },
    reviewedAt: { type: Date, required: false },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
    rejectionReason: { type: String, trim: true, required: false },
}, { timestamps: true });
export const CaregiverApplicationModel = mongoose.models.CaregiverApplication ??
    mongoose.model("CaregiverApplication", caregiverApplicationSchema);
