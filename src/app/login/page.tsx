import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Cadence" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
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

        <h1 className="text-center text-xl font-semibold">Cadence</h1>
        <p className="mt-2 text-center text-sm text-fg-muted">
          This instance is private. Sign in with your email and password.
        </p>

        <LoginForm />
      </div>
    </div>
  );
}
