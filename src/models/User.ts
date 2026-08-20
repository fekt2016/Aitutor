import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ROLES, isRole } from "@/features/auth/roles";

/**
 * User — every account (superadmin/admin/teacher/parent/student).
 * Plan §27: one `role` field; `superAdmin` flag for platform-level checks.
 * Exact birthdates are never stored — only an age band (plan §11, §19).
 */

export const AGE_BANDS = ["5-6", "7-8", "9-10", "11-12"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export function isAgeBand(value: string): value is AgeBand {
  return (AGE_BANDS as readonly string[]).includes(value);
}

const userSchema = new Schema(
  {
    username: {
      type: String,
      unique: true,
      sparse: true, // multiple accounts may have no username
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
      match: [/^[a-z0-9._-]+$/, "Username may only contain letters, numbers, dots, dashes and underscores."],
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // children may have only a username, no email
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address."],
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 20,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    role: {
      type: String,
      required: true,
      enum: {
        values: ROLES,
        message: "Unknown role.",
      },
      validate: {
        validator: (v: string) => isRole(v),
        message: "Unknown role.",
      },
    },
    ageBand: {
      type: String,
      enum: {
        values: AGE_BANDS,
        message: "Unknown age band.",
      },
      validate: {
        validator: (v: string) => isAgeBand(v),
        message: "Unknown age band.",
      },
    },
    superAdmin: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

userSchema.index({ role: 1 });

export type User = InferSchemaType<typeof userSchema>;

export const UserModel =
  (mongoose.models.User as Model<User> | undefined) ?? mongoose.model<User>("User", userSchema);

/** Public view of a user — never exposes passwordHash or internal flags. */
export function toPublicUser(user: User) {
  return {
    id: (user as unknown as { _id: unknown })._id?.toString(),
    email: user.email ?? null,
    username: user.username ?? null,
    name: user.name,
    role: user.role,
    ageBand: user.ageBand ?? null,
    createdAt: user.createdAt,
  };
}
