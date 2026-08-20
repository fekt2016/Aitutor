/**
 * Auth gate (plan §26, §28) — proxy (Next 16, formerly middleware)
 * protects page routes only. API routes enforce their own auth server-side
 * via getSessionUser()/requireRole() so they always return proper 401 JSON
 * (defense in depth).
 */
import { auth } from "@/features/auth/nextauth";

const PUBLIC_PATHS = ["/login", "/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth);
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  // Matches app pages that require a session (tutor + dashboard shells).
  // Excludes /api — those handlers authorize themselves.
  matcher: ["/dashboard/:path*", "/tutor/:path*"],
};
