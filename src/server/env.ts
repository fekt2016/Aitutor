/**
 * Env-driven configuration (plan §2, §38).
 *
 * `getEnv()` validates + caches required variables and throws a clear,
 * actionable error when something is missing. It is lazy — the app shell
 * renders without env configured; only DB/auth paths require it.
 *
 * All secrets live in `.env` (gitignored); `.env.example` is the template.
 */

export interface Env {
  NODE_ENV: "development" | "production" | "test";
  /** MongoDB connection string (may contain a `<password>` placeholder). */
  MONGO_URL: string;
  /** Optional password substituted into MONGO_URL's `<password>` placeholder. */
  DATABASE_PASSWORD?: string;
  AUTH_SECRET: string;
  NEXTAUTH_URL: string;
  APP_URL: string;
  BCRYPT_SALT_ROUNDS?: string;
  /** Active AI provider adapter ("openai" default; plan §8.3). */
  AI_PROVIDER?: string;
  /** OpenAI credentials + model routing (plan §8.2, §9). */
  OPENAI_API_KEY?: string;
  OPENAI_MODEL_TUTOR?: string;
  OPENAI_MODEL_STRUCTURED?: string;
  /** Message cap per tutor session (plan §28, §30). */
  SESSION_MSG_CAP: number;
  /** Session cap per student per day. */
  DAILY_SESSION_CAP: number;
  /** Transcript retention in days (plan §19). */
  RETENTION_DAYS: number;
}

const REQUIRED: Array<keyof Env> = ["MONGO_URL", "AUTH_SECRET"];

function requireString(source: Record<string, string | undefined>, key: string): string {
  const value = source[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable "${key}". ` +
        `Copy .env.example to .env and fill it in before running the app.`
    );
  }
  return value.trim();
}

function requireInt(
  source: Record<string, string | undefined>,
  key: string,
  fallback: number,
  min = 1
): number {
  const raw = source[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`Environment variable "${key}" must be an integer ≥ ${min}.`);
  }
  return parsed;
}

/**
 * Resolves the Mongo connection string.
 * - `DATABASE_PASSWORD` is the authoritative password when set: it replaces a
 *   `<password>` placeholder, or overrides a literal password embedded in the
 *   URL. This keeps credentials out of git-tracked files and allows rotating
 *   the DB password without editing the connection string.
 * - If the password is already percent-encoded, it is used as-is.
 */
function encodePassword(password: string): string {
  return password.includes("%") ? password : encodeURIComponent(password);
}

function resolveMongoUrl(source: Record<string, string | undefined>): string {
  const raw = requireString(source, "MONGO_URL");
  return substitutePassword(raw, source.DATABASE_PASSWORD);
}

/** Password substitution shared with scripts (seed) that only need the DB URL. */
export function substitutePassword(raw: string, password: string | undefined): string {
  if (!password) return raw;

  // Atlas template: mongodb+srv://user:<password>@cluster/...
  if (/<password>/i.test(raw)) {
    return raw.replace(/<password>/i, encodePassword(password));
  }

  // URL with an embedded literal password: mongodb://user:pass@host
  const match = raw.match(/^(mongodb(\+srv)?:\/\/)([^:]+):([^@]*)@(.*)$/);
  if (match) {
    return `${match[1]}${match[3]}:${encodePassword(password)}@${match[5]}`;
  }

  return raw;
}

let cached: Env | null = null;

export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;

  const env: Env = {
    NODE_ENV: (source.NODE_ENV as Env["NODE_ENV"]) ?? "development",
    MONGO_URL: resolveMongoUrl(source),
    DATABASE_PASSWORD: source.DATABASE_PASSWORD,
    AUTH_SECRET: requireString(source, "AUTH_SECRET"),
    NEXTAUTH_URL: source.NEXTAUTH_URL?.trim() || "http://localhost:3000",
    APP_URL:
      source.NEXT_PUBLIC_APP_URL?.trim() || source.NEXTAUTH_URL?.trim() || "http://localhost:3000",
    BCRYPT_SALT_ROUNDS: source.BCRYPT_SALT_ROUNDS,
    AI_PROVIDER: source.AI_PROVIDER?.trim() || "openai",
    OPENAI_API_KEY: source.OPENAI_API_KEY?.trim(),
    OPENAI_MODEL_TUTOR: source.OPENAI_MODEL_TUTOR?.trim(),
    OPENAI_MODEL_STRUCTURED: source.OPENAI_MODEL_STRUCTURED?.trim(),
    SESSION_MSG_CAP: requireInt(source, "SESSION_MSG_CAP", 30),
    DAILY_SESSION_CAP: requireInt(source, "DAILY_SESSION_CAP", 3),
    RETENTION_DAYS: requireInt(source, "RETENTION_DAYS", 30),
  };

  // Only validate when NOT in tests (tests set their own values in setup).
  if (env.NODE_ENV !== "test") {
    for (const key of REQUIRED) {
      if (!env[key]) {
        throw new Error(
          `Missing required environment variable "${key}". ` +
            `Copy .env.example to .env and fill it in before running the app.`
        );
      }
    }
  }

  cached = env;
  return env;
}

export function resetEnvCache(): void {
  cached = null;
}
