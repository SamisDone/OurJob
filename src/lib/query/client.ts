import {
  defaultShouldDehydrateQuery,
  environmentManager,
  QueryClient,
  type QueryClientConfig,
} from "@tanstack/react-query";

/**
 * TanStack Query setup for the App Router, following the TanStack Query v5
 * "Advanced Server Rendering" guide (checked for 5.105.0, 2026-10-29).
 * Server components prefetch into a fresh client per request and dehydrate
 * it; the browser keeps one client for the session.
 */

export const DEFAULT_STALE_TIME_MS = 60_000;

export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Above zero so data hydrated from the server is not refetched right away.
      staleTime: DEFAULT_STALE_TIME_MS,
      retry: 1,
    },
    mutations: {
      // Mutations change his data; never repeat one silently.
      retry: 0,
    },
    dehydrate: {
      // Also send queries still pending, so server prefetches can stream.
      shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      // Next.js uses thrown errors to detect dynamic rendering; do not hide them.
      shouldRedactErrors: () => false,
    },
  },
};

export function makeQueryClient() {
  return new QueryClient(queryClientConfig);
}

let browserClient: QueryClient | undefined;

/**
 * A new client for every server request (so one person's data can never leak
 * into another request), one shared client in the browser. In 5.105 the
 * server check is `environmentManager.isServer()`, a function; older v5
 * releases exported `isServer` as a boolean.
 */
export function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}

/**
 * Options for every query in the tailor workspace. Coming back to the tab
 * must not refetch a job spec or tailoring mid-edit.
 */
export const tailorWorkspaceQueryOptions = {
  refetchOnWindowFocus: false,
} as const;
