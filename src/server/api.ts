import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { auth } from "@/auth";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, details: error.details ?? null },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request", details: error.issues },
      { status: 400 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      // The one-running-entry index and a duplicate project name both land
      // here; they deserve different messages.
      const target = String(error.meta?.target ?? "");
      if (target.includes("endedAt")) {
        return NextResponse.json(
          { error: "A timer is already running" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "That name is already taken" }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // 23P01 = exclusion violation: the overlap constraint caught a race that
    // slipped past the application-level check.
    if (error.code === "P2010" || String(error.message).includes("23P01")) {
      return NextResponse.json(
        { error: "That time range overlaps another entry" },
        { status: 409 },
      );
    }
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

type RouteHandler<Ctx> = (request: Request, context: Ctx) => Promise<unknown>;

/**
 * Wraps a handler with the session check and error mapping. Unauthenticated
 * requests get a 401 rather than a redirect, so a stale tab never receives an
 * HTML login page where it expected JSON.
 */
export function route<Ctx = unknown>(handler: RouteHandler<Ctx>) {
  return async (request: Request, context: Ctx): Promise<Response> => {
    try {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      const result = await handler(request, context);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return toResponse(error);
    }
  };
}

/**
 * For the cron-triggered alert route, which has no session. Compares the shared
 * secret in constant time. See ARCHITECTURE.md §6.
 */
export function routeWithSecret(handler: RouteHandler<unknown>) {
  return async (request: Request, context: unknown): Promise<Response> => {
    try {
      const provided = request.headers.get("x-cron-key") ?? "";
      const expected = process.env.CRON_SECRET ?? "";
      if (!expected || !timingSafeEqualString(provided, expected)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const result = await handler(request, context);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return toResponse(error);
    }
  };
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function searchParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

export function requiredDate(params: URLSearchParams, key: string): Date {
  const raw = params.get(key);
  const value = raw ? new Date(raw) : null;
  if (!value || Number.isNaN(value.getTime())) {
    throw new ApiError(400, `Missing or invalid "${key}" parameter`);
  }
  return value;
}
