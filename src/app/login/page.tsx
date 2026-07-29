import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const metadata = { title: "Sign in · Cadence" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft">
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-accent"
            />
            <path
              d="M12 7v5l3.5 2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-accent"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold">Cadence</h1>
        <p className="mt-2 text-sm text-fg-muted">
          This instance is private. Only one Google account can sign in.
        </p>

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition hover:opacity-90"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
