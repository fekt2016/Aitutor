/**
 * Prints active subjects as "id name" lines — ops helper used by
 * scripts/verify-tutor.sh (the tutor page lists subjects server-side,
 * so there is no public API to fetch them from bash).
 *
 * Run:  npx tsx --env-file=.env scripts/list-subjects.ts
 */
import mongoose from "mongoose";
import { substitutePassword } from "../src/server/env";
import { SubjectModel } from "../src/models";

async function main(): Promise<void> {
  const mongoUrl = substitutePassword(process.env.MONGO_URL ?? "", process.env.DATABASE_PASSWORD);
  if (!mongoUrl) {
    console.error("MONGO_URL is not set.");
    process.exit(1);
  }
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10_000 });
  const subjects = await SubjectModel.find({ active: true })
    .sort({ sortOrder: 1 })
    .select("name")
    .lean();
  for (const subject of subjects) {
    console.log(`${subject._id.toString()} ${subject.name}`);
  }
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("list-subjects failed:", error);
  process.exit(1);
});
