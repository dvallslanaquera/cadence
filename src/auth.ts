import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/** Single-user auth: email + password against env vars, no user table or hashing, JWT sessions so no adapter. See ARCHITECTURE.md §15. */
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
  /** Auth.js only auto-trusts host on recognised platforms; without this `next start` and local dev fail with UntrustedHost even with valid credentials. */
  trustHost: true,
});

/** Constant-time compare so a wrong guess leaks no timing signal; length differences handled without short-circuit. */
function safeEqualString(a: string, b: string): boolean {
  let mismatch = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    mismatch |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
  }
  return mismatch === 0;
}
