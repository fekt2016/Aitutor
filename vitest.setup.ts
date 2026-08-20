import { afterEach } from "vitest";
import mongoose from "mongoose";

// Deterministic test environment — never touch real credentials in tests.
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.AUTH_SECRET = "test-secret-that-is-at-least-32-characters-long";
process.env.MONGO_URL = "mongodb://127.0.0.1:27017/eazworld-test";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.BCRYPT_SALT_ROUNDS = "4"; // fast hashing in tests

afterEach(async () => {
  // Clean up any in-memory/registered mongoose state between tests.
  await mongoose.connection.close().catch(() => {});
});
