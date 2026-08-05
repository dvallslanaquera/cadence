"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { LanguageSync } from "@/lib/i18n-client";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // ApiClientError means the server rejected the call (e.g. 401); retrying would loop.
              if (error instanceof Error && error.name === "ApiClientError") return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <LanguageSync />
      {children}
      <Toaster position="bottom-center" closeButton richColors />
    </QueryClientProvider>
  );
}
