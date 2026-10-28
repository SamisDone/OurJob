import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { getQueryClient, makeQueryClient, queryClientConfig, tailorWorkspaceQueryOptions } from "@/lib/query/client";
import { createOptimisticHandlers } from "@/lib/query/optimistic";
import { tailorSteps } from "@/lib/query/tailor-progress";
import { mutationKeys, normalizeFeedFilters, queryKeys } from "@/lib/query-keys";

describe("query keys", () => {
  it("gives equivalent feed filters the same key", () => {
    expect(queryKeys.feed.list({ seniority: ["senior", "mid"], payListed: true, search: " React " })).toEqual(
      queryKeys.feed.list({ search: "react", seniority: ["mid", "senior"], payListed: true, sort: "fit" }),
    );
  });

  it("drops empty and false filters and fills the default sort", () => {
    expect(normalizeFeedFilters({ directOnly: false, seniority: [], search: "  " })).toEqual({ sort: "fit" });
  });

  it("keeps different filters apart", () => {
    expect(queryKeys.feed.list({ directOnly: true })).not.toEqual(queryKeys.feed.list({}));
  });

  it("nests every feed list under the feed prefix", () => {
    expect(queryKeys.feed.list({ sort: "pay" }).slice(0, 1)).toEqual(queryKeys.feed.all);
  });

  it("has a mutation key for each tailoring step", () => {
    expect(mutationKeys.tailor.parse).toEqual(["tailor", "parse"]);
    expect(mutationKeys.tailor.tailor).toEqual(["tailor", "tailor"]);
  });
});

type Job = { id: string; status: "new" | "saved" | "dismissed" };

describe("optimistic handlers", () => {
  const seed = () => {
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.feed.list({}), [
      { id: "a", status: "new" },
      { id: "b", status: "new" },
    ] satisfies Job[]);
    qc.setQueryData(queryKeys.feed.list({ directOnly: true }), [{ id: "a", status: "new" }] satisfies Job[]);
    return qc;
  };
  const dismiss = (qc: QueryClient) =>
    createOptimisticHandlers<{ id: string }>(qc, [
      {
        queryKey: queryKeys.feed.all,
        apply: (old, { id }) => (old as Job[]).filter((j) => j.id !== id),
      },
    ]);

  it("updates every cached feed list under the prefix before the request", async () => {
    const qc = seed();
    await dismiss(qc).onMutate({ id: "a" });
    expect(qc.getQueryData<Job[]>(queryKeys.feed.list({}))?.map((j) => j.id)).toEqual(["b"]);
    expect(qc.getQueryData<Job[]>(queryKeys.feed.list({ directOnly: true }))).toEqual([]);
  });

  it("rolls every list back when the request fails", async () => {
    const qc = seed();
    const h = dismiss(qc);
    const ctx = await h.onMutate({ id: "a" });
    h.onError(new Error("network"), { id: "a" }, ctx);
    expect(qc.getQueryData<Job[]>(queryKeys.feed.list({}))?.map((j) => j.id)).toEqual(["a", "b"]);
    expect(qc.getQueryData<Job[]>(queryKeys.feed.list({ directOnly: true }))?.map((j) => j.id)).toEqual(["a"]);
  });

  it("marks the lists stale afterwards so the server's version wins", async () => {
    const qc = seed();
    const h = dismiss(qc);
    await h.onMutate({ id: "a" });
    await h.onSettled();
    expect(qc.getQueryState(queryKeys.feed.list({}))?.isInvalidated).toBe(true);
  });

  it("leaves queries with no cached data alone", async () => {
    const qc = new QueryClient();
    await dismiss(qc).onMutate({ id: "a" });
    expect(qc.getQueryData(queryKeys.feed.list({}))).toBeUndefined();
  });
});

describe("tailorSteps", () => {
  it("shows reading first, then tailoring", () => {
    expect(tailorSteps("pending", "idle").map((s) => s.state)).toEqual(["running", "todo"]);
    expect(tailorSteps("success", "pending").map((s) => s.state)).toEqual(["done", "running"]);
    expect(tailorSteps("success", "success").map((s) => s.state)).toEqual(["done", "done"]);
  });

  it("shows which step failed", () => {
    expect(tailorSteps("error", "idle").map((s) => s.state)).toEqual(["failed", "todo"]);
    expect(tailorSteps("success", "error").map((s) => s.state)).toEqual(["done", "failed"]);
  });

  it("names the steps as DESIGN.md does", () => {
    expect(tailorSteps("idle", "idle").map((s) => s.label)).toEqual(["Reading the job", "Tailoring your CV"]);
  });
});

describe("query client", () => {
  it("keeps data fresh for about a minute and never retries mutations", () => {
    const qc = makeQueryClient();
    expect(qc.getDefaultOptions().queries?.staleTime).toBe(60_000);
    expect(qc.getDefaultOptions().mutations?.retry).toBe(0);
  });

  it("dehydrates pending queries so server prefetches can stream", () => {
    const should = queryClientConfig.defaultOptions?.dehydrate?.shouldDehydrateQuery;
    expect(should?.({ state: { status: "pending" } } as never)).toBe(true);
  });

  it("makes a fresh client per call on the server", () => {
    // Vitest runs in Node with no window, so TanStack Query treats it as the server.
    expect(getQueryClient()).not.toBe(getQueryClient());
  });

  it("turns off refetch on focus for the tailor workspace", () => {
    expect(tailorWorkspaceQueryOptions.refetchOnWindowFocus).toBe(false);
  });
});
