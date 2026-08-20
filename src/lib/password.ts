import bcrypt from "bcryptjs";

/**
 * Password hashing (bcrypt). Cost is env-driven so tests can use a fast
 * round count; production defaults to 12.
 */
function saltRounds(): number {
  const raw = process.env.BCRYPT_SALT_ROUNDS;
  if (!raw) return 12;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 4 || parsed > 15) return 12;
  return parsed;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, saltRounds());
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
