"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getQueryClient } from "@/lib/query/client";

/**
 * Client data provider. The browser client is a module singleton rather than
 * useState, as TanStack Query's App Router guide recommends: React can throw
 * away state from a render that suspends before any boundary.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
