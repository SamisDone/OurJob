"use client";

import { useMutation, useMutationState, useQueryClient, type MutationKey, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { mutationKeys } from "@/lib/query-keys";
import { createOptimisticHandlers, type OptimisticContext, type OptimisticTarget } from "./optimistic";
import { tailorSteps, type MutationStatus } from "./tailor-progress";

/**
 * useMutation with an optimistic update and rollback on error. With `undo`,
 * a toast confirms the action ("Dismissed.") and its Undo button runs the
 * inverse mutation. On error the cache is rolled back and the toast says what
 * happened.
 */
export function useOptimisticMutation<TData, TVariables>({
  mutationKey,
  mutationFn,
  targets,
  invalidate,
  success,
  undo,
  errorMessage = "That did not save. Your change was undone; try again.",
}: {
  mutationKey: MutationKey;
  mutationFn: (variables: TVariables) => Promise<TData>;
  targets: OptimisticTarget<TVariables>[];
  invalidate?: QueryKey[];
  /** Toast text on success, using the same verb as the button: "Saved", "Dismissed." */
  success?: string | ((variables: TVariables) => string);
  /** Runs when the person presses Undo in the toast. */
  undo?: (variables: TVariables) => void;
  errorMessage?: string;
}) {
  const queryClient = useQueryClient();
  const handlers = createOptimisticHandlers<TVariables>(queryClient, targets, { invalidate });
  return useMutation<TData, Error, TVariables, OptimisticContext>({
    mutationKey,
    mutationFn,
    onMutate: (variables) => handlers.onMutate(variables),
    onError: (error, variables, context) => {
      handlers.onError(error, variables, context);
      toast(errorMessage);
    },
    onSuccess: (_data, variables) => {
      if (!success) return;
      const message = typeof success === "function" ? success(variables) : success;
      toast(message, undo ? { action: { label: "Undo", onClick: () => undo(variables) } } : undefined);
    },
    onSettled: () => handlers.onSettled(),
  });
}

function latestStatus(statuses: string[]): MutationStatus {
  return (statuses[statuses.length - 1] as MutationStatus | undefined) ?? "idle";
}

/**
 * The tailoring progress steps, read from the parse and tailor mutations
 * wherever they are running. Any component can show them without prop
 * drilling.
 */
export function useTailorProgress() {
  const parse = useMutationState({
    filters: { mutationKey: mutationKeys.tailor.parse },
    select: (m) => m.state.status,
  });
  const tailor = useMutationState({
    filters: { mutationKey: mutationKeys.tailor.tailor },
    select: (m) => m.state.status,
  });
  return tailorSteps(latestStatus(parse), latestStatus(tailor));
}
