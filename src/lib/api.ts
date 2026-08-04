/** Thin fetch wrapper. Surfaces the server's message so 409s stay readable. */

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    // A stale tab: the session went away while the page stayed open. Skip the
    // redirect when already on /login, or the login page's own settings fetch
    // (LanguageSync/AppShell) would 401 and reload /login onto itself forever.
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiClientError(401, "Signed out");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      (payload as { error?: string } | null)?.error ?? "Something went wrong",
      (payload as { details?: unknown } | null)?.details,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
