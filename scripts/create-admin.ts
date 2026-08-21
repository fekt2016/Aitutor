/**
 * Creates or promotes an admin user (idempotent) — needed to reach the
 * /admin/curriculum editor. Config via env:
 *   ADMIN_EMAIL (default admin@eazworld.test)
 *   ADMIN_PASSWORD (default ChangeMe-Admin-1!)
 *   ADMIN_NAME (default "EazWorld Admin")
 *
 * If the email exists as a non-admin, the account is PROMOTED to superadmin
 * (never demoted). Run: npm run create:admin
 */
import mongoose from "mongoose";
import { substitutePassword } from "../src/server/env";
import { UserModel } from "../src/models";
import { hashPassword } from "../src/lib/password";

async function main(): Promise<void> {
  const mongoUrl = substitutePassword(process.env.MONGO_URL ?? "", process.env.DATABASE_PASSWORD);
  if (!mongoUrl) {
    console.error("MONGO_URL is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  const email = (process.env.ADMIN_EMAIL ?? "admin@eazworld.test").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe-Admin-1!";
  const name = process.env.ADMIN_NAME ?? "EazWorld Admin";

  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10_000 });
  try {
    const existing = await UserModel.findOne({ email });
    if (existing) {
      if (existing.role === "superadmin" || existing.role === "admin") {
        console.log(`Admin already exists: ${email} (${existing.role})`);
        return;
      }
      await UserModel.updateOne({ _id: existing._id }, { $set: { role: "superadmin" } });
      console.log(`Promoted existing user ${email} to superadmin.`);
      return;
    }
    await UserModel.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "superadmin",
    });
    console.log(`Created superadmin ${email} (password from ADMIN_PASSWORD).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("create-admin failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
