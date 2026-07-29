import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Single-user auth: email + password checked against env vars. No user table,
 * no password hashing, no OAuth provider to register. JWT sessions, so there is
 * no adapter. See ARCHITECTURE.md §15.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize(raw) {
        const expectedEmail = process.env.AUTH_EMAIL?.trim().toLowerCase();
        const expectedPassword = process.env.AUTH_PASSWORD ?? "";
        // Fail closed if the credentials are not configured.
        if (!expectedEmail || !expectedPassword) return null;

        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) return null;

        const emailOk = email === expectedEmail;
        const passwordOk = safeEqualString(password, expectedPassword);
        if (!emailOk || !passwordOk) return null;

        return { id: "1", name: "Cadence", email: expectedEmail };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  /**
   * Auth.js only auto-trusts the request host on recognised platforms, so
   * without this `next start` and local dev fail with UntrustedHost even with
   * valid credentials.
   */
  trustHost: true,
});

/**
 * Constant-time string compare, so a wrong guess leaks no timing signal about
 * how many bytes matched. Length differences are handled without short-circuit.
 */
function safeEqualString(a: string, b: string): boolean {
  let mismatch = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    mismatch |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
  }
  return mismatch === 0;
}
