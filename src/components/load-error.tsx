"use client";

import { CircleAlert, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Something did not load or save: what happened, why, and a retry when one helps. */
export function LoadError({
  title,
  children,
  onRetry,
  className,
}: {
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <CircleAlert />
      <AlertTitle>{title}</AlertTitle>
      {children && <AlertDescription>{children}</AlertDescription>}
      {onRetry && (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCw data-icon="inline-start" />
            Try again
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}
