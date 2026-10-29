"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { applyEdits, type EditOp } from "@/lib/profile/edit";
import type { MasterProfile, SearchPreferences } from "@/lib/profile/schema";
import { mutationKeys, queryKeys } from "@/lib/query-keys";
import { useOptimisticMutation } from "./hooks";

/** Client data for onboarding, the profile editor and search preferences. */

export type SourceSummary = {
  kind: string;
  filename: string | null;
  chars: number;
  preview: string;
  meta: Record<string, unknown>;
  addedAt: string;
};

export type ProfileVersionDto = {
  version: number;
  data: MasterProfile;
  isCurrent: boolean;
  confirmedAt: string | null;
  createdAt: string;
  note: string | null;
};

export type VersionSummary = Omit<ProfileVersionDto, "data">;

/* Sources ------------------------------------------------------------------ */

export function useSources() {
  return useQuery({
    queryKey: queryKeys.profile.sources,
    queryFn: ({ signal }) => api<{ sources: SourceSummary[] }>("/api/sources", { signal }).then((r) => r.sources),
  });
}

function useSourcesMutation<V, R extends { sources: SourceSummary[] }>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => qc.setQueryData(queryKeys.profile.sources, r.sources),
  });
}

export function useUploadSource() {
  return useSourcesMutation(({ file, linkedin }: { file: File; linkedin?: boolean }) => {
    const form = new FormData();
    form.set("file", file);
    if (linkedin) form.set("kind", "linkedin");
    return api<{ sources: SourceSummary[] }>("/api/sources", { method: "POST", body: form });
  });
}

export function useImportGitHub() {
  return useSourcesMutation((username: string) =>
    api<{
      sources: SourceSummary[];
      counts: { publicRepos: number; ownRepos: number; withReadme: number };
      login: string;
    }>("/api/sources/github", { method: "POST", json: { username } }),
  );
}

export function useImportPortfolio() {
  return useSourcesMutation((url: string) =>
    api<{ sources: SourceSummary[]; thin: boolean; chars: number; url: string; title: string | null }>(
      "/api/sources/portfolio",
      { method: "POST", json: { url } },
    ),
  );
}

export function useSaveTextSource() {
  return useSourcesMutation((body: { kind: "notes" | "portfolio" | "cv"; text: string; url?: string }) =>
    api<{ sources: SourceSummary[] }>("/api/sources/text", { method: "POST", json: body }),
  );
}

export function useRemoveSource() {
  return useSourcesMutation((kind: string) =>
    api<{ sources: SourceSummary[] }>(`/api/sources?kind=${encodeURIComponent(kind)}`, { method: "DELETE" }),
  );
}

/* Profile ------------------------------------------------------------------ */

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.current,
    queryFn: ({ signal }) =>
      api<{ profile: ProfileVersionDto | null }>("/api/profile", { signal }).then((r) => r.profile),
  });
}

export function useBuildProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["profile", "build"],
    mutationFn: () =>
      api<{ profile: ProfileVersionDto }>("/api/profile/build", { method: "POST" }).then((r) => r.profile),
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.profile.current, profile);
      void qc.invalidateQueries({ queryKey: queryKeys.profile.versions });
    },
  });
}

/**
 * Profile edits, optimistic: the same applyEdits the server runs updates the
 * cache at once; an error rolls it back and says why.
 */
export function useEditProfile(opts: { success?: string; undo?: () => void } = {}) {
  return useOptimisticMutation<ProfileVersionDto, EditOp[]>({
    mutationKey: mutationKeys.profile.edit,
    mutationFn: (ops) =>
      api<{ profile: ProfileVersionDto }>("/api/profile", { method: "PATCH", json: { ops } }).then((r) => r.profile),
    targets: [
      {
        queryKey: queryKeys.profile.current,
        apply: (old, ops) => {
          const current = old as ProfileVersionDto | null;
          if (!current) return old;
          try {
            return { ...current, data: applyEdits(current.data, ops).profile };
          } catch {
            return old;
          }
        },
      },
    ],
    invalidate: [queryKeys.profile.current, queryKeys.profile.versions],
    success: opts.success,
    undo: opts.undo ? () => opts.undo!() : undefined,
    errorMessage: "That change was not saved, so it was undone.",
  });
}

export function useProfileVersions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.profile.versions,
    queryFn: ({ signal }) =>
      api<{ versions: VersionSummary[] }>("/api/profile/versions", { signal }).then((r) => r.versions),
    enabled,
  });
}

export function useRestoreVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) =>
      api<{ profile: ProfileVersionDto }>(`/api/profile/versions/${version}/restore`, { method: "POST" }).then(
        (r) => r.profile,
      ),
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.profile.current, profile);
      void qc.invalidateQueries({ queryKey: queryKeys.profile.versions });
    },
  });
}

export function useConfirmProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ profile: ProfileVersionDto }>("/api/profile/confirm", { method: "POST" }).then((r) => r.profile),
    onSuccess: (profile) => qc.setQueryData(queryKeys.profile.current, profile),
  });
}

/* Preferences ---------------------------------------------------------------- */

export function usePreferences(enabled = true) {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: ({ signal }) => api<{ data: SearchPreferences; suggested: boolean }>("/api/preferences", { signal }),
    enabled,
    // The first load may run P5 on the server; do not repeat it on focus.
    refetchOnWindowFocus: false,
  });
}

export function useSavePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SearchPreferences) =>
      api<{ data: SearchPreferences; suggested: boolean }>("/api/preferences", { method: "PUT", json: data }),
    onSuccess: (r) => qc.setQueryData(queryKeys.preferences, r),
  });
}
