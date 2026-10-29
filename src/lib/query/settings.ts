"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AiSettings = {
  tailorModel: "standard" | "thorough";
  models: { standard: string; thorough: string | null };
};

export function useAiSettings() {
  return useQuery({
    queryKey: queryKeys.settings.ai,
    queryFn: ({ signal }) => api<AiSettings>("/api/settings/ai", { signal }),
  });
}

export function useSaveTailorModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tailorModel: AiSettings["tailorModel"]) =>
      api<AiSettings>("/api/settings/ai", { method: "PUT", json: { tailorModel } }),
    onMutate: async (tailorModel) => {
      await qc.cancelQueries({ queryKey: queryKeys.settings.ai });
      const prev = qc.getQueryData<AiSettings>(queryKeys.settings.ai);
      if (prev) qc.setQueryData(queryKeys.settings.ai, { ...prev, tailorModel });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(queryKeys.settings.ai, ctx.prev),
    onSuccess: (r) => qc.setQueryData(queryKeys.settings.ai, r),
  });
}
