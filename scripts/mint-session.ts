/**
 * Local dev only: mint an Auth.js session cookie so the app can be used without
 * a Google OAuth round-trip. Same technique as http-smoke.ts, which needs it to
 * exercise the authenticated paths.
 *
 *   npx tsx --env-file-if-exists=.env scripts/mint-session.ts
 *
 * Prints a one-liner to paste into the DevTools console. The cookie is only as
 * good as AUTH_SECRET, so this is worthless against a deployment whose secret
 * you do not already have.
 */
import { encode } from "next-auth/jwt";

const COOKIE = "authjs.session-token";

async function main() {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET must be set");

  const token = await encode({
    token: {
      name: "Local",
      email: process.env.ALLOWED_EMAIL,
      sub: "local-dev",
    },
    secret: process.env.AUTH_SECRET,
    salt: COOKIE,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  console.log("\nPaste into the DevTools console at http://localhost:3000/login\n");
  console.log(
    `document.cookie = "${COOKIE}=${token}; path=/; max-age=2592000"; location.href = "/";`,
  );
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
