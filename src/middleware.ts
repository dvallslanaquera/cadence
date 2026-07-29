import { auth } from "@/auth";

/**
 * Page protection only. API routes answer with 401 JSON instead of redirecting,
 * so a stale tab never receives an HTML login page where it expected JSON.
 */
export default auth((request) => {
  const { pathname } = request.nextUrl;
  if (pathname === "/login") return;
  if (!request.auth) {
    const url = new URL("/login", request.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)",
  ],
};
