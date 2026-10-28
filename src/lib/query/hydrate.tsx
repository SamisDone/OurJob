import "server-only";
import { dehydrate, HydrationBoundary, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getQueryClient } from "./client";

/**
 * Server-side first page of data. A server component calls `prefetch` with
 * the same key and query function the client hook uses, then wraps the
 * client part in <Hydrate>. The client then reads the cache instead of
 * refetching, and later updates go through TanStack Query.
 *
 *   const qc = serverQueryClient();
 *   void qc.prefetchQuery({ queryKey: queryKeys.feed.list(filters), queryFn: () => getFeed(userId, filters) });
 *   return <Hydrate client={qc}><TodayFeed /></Hydrate>;
 *
 * Server components only prefetch; they do not render query data themselves
 * (TanStack Query cannot revalidate server output).
 */
export function serverQueryClient(): QueryClient {
  return getQueryClient();
}

export function Hydrate({ client, children }: { client: QueryClient; children: ReactNode }) {
  return <HydrationBoundary state={dehydrate(client)}>{children}</HydrationBoundary>;
}
