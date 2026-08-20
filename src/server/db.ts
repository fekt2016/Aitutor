/**
 * MongoDB connection (plan §27, §33) — lazy singleton, serverless-safe.
 * Connection string is read from env; it is never logged.
 */
import mongoose from "mongoose";
import { getEnv } from "./env";
import { AppError } from "@/lib/errors";

let connectionPromise: Promise<typeof mongoose> | null = null;

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function connectToDatabase(): Promise<typeof mongoose> {
  if (isDbConnected()) return Promise.resolve(mongoose);
  if (connectionPromise) return connectionPromise;

  const { MONGO_URL } = getEnv();
  connectionPromise = mongoose
    .connect(MONGO_URL, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      maxPoolSize: 10,
      minPoolSize: 0,
    })
    .catch((error) => {
      connectionPromise = null; // allow retry on next call
      throw error;
    });

  return connectionPromise;
}

/**
 * Connects for a request or throws a safe, child-friendly 503
 * (plan §37: DB failure → warm message, never a stack trace).
 */
export async function ensureDb(): Promise<typeof mongoose> {
  try {
    return await connectToDatabase();
  } catch (error) {
    console.error("[db] connection failed (correlation available in logs)", {
      readyState: mongoose.connection.readyState,
      name: error instanceof Error ? error.name : typeof error,
    });
    throw AppError.dependencyUnavailable(
      "Our learning books are taking a rest. Please try again in a moment."
    );
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  connectionPromise = null;
  await mongoose.disconnect().catch(() => {});
}
