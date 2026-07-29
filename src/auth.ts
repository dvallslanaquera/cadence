import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Single-user auth: Google OAuth, allowlisted to one address.
 * JWT sessions, so there is no adapter and no user table to keep.
 * See ARCHITECTURE.md §15.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  /**
   * Auth.js only auto-trusts the request host on recognised platforms, so
   * without this `next start` and local dev fail with UntrustedHost even with
   * valid credentials. The mitigation host-checking provides — blocking
   * Host-header spoofing to forge a callback URL — is already covered here:
   * sign-in is allowlisted to one address, and the OAuth redirect URI is
   * pinned in the Google console.
   */
  trustHost: true,
  callbacks: {
    signIn({ profile }) {
      const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
      if (!allowed) return false; // fail closed if the allowlist is unset
      return profile?.email?.toLowerCase() === allowed && profile.email_verified !== false;
    },
  },
});
