import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Optimistic update handlers for useMutation (save, dismiss, mark applied,
 * tracker moves, profile edits). Before the request: cancel in-flight fetches
 * of the target queries, snapshot them, apply the change. On error: put the
 * snapshots back. Afterwards: invalidate so the server's version wins.
 *
 * Targets can be exact keys or prefixes: ["feed"] updates every filtered
 * feed list in the cache.
 */

export type OptimisticTarget<TVariables> = {
  /** A key or key prefix; every cached query under it is updated. */
  queryKey: QueryKey;
  /** Returns the new cached value. Must not mutate `old`. Return `old` to leave it. */
  apply: (old: unknown, variables: TVariables) => unknown;
};

export type OptimisticContext = { snapshots: [QueryKey, unknown][] };

export function createOptimisticHandlers<TVariables>(
  queryClient: QueryClient,
  targets: OptimisticTarget<TVariables>[],
  opts: { invalidate?: QueryKey[] } = {},
) {
  return {
    async onMutate(variables: TVariables): Promise<OptimisticContext> {
      await Promise.all(targets.map((t) => queryClient.cancelQueries({ queryKey: t.queryKey })));
      const snapshots: [QueryKey, unknown][] = [];
      for (const t of targets) {
        for (const [key, data] of queryClient.getQueriesData({ queryKey: t.queryKey })) {
          snapshots.push([key, data]);
          if (data !== undefined) queryClient.setQueryData(key, t.apply(data, variables));
        }
      }
      return { snapshots };
    },

    onError(_error: unknown, _variables: TVariables, context: OptimisticContext | undefined) {
      for (const [key, data] of context?.snapshots ?? []) queryClient.setQueryData(key, data);
    },

    async onSettled() {
      const keys = opts.invalidate ?? targets.map((t) => t.queryKey);
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  };
}
