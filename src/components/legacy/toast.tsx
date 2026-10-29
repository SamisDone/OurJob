"use client";

import { Toaster as Sonner, toast } from "sonner";

/**
 * Toasts: bottom right on desktop, bottom center on phones, 5 s, with Undo
 * where an action can be reversed. Copy uses the same verb as the button:
 * "Dismissed. Undo".
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      duration={5000}
      gap={8}
      visibleToasts={3}
      mobileOffset={{ bottom: 80 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[min(380px,calc(100vw-32px))] items-center gap-3 rounded-panel bg-ink px-4 py-3 text-sm text-sheet shadow-pop",
          title: "font-medium",
          description: "text-sheet/75",
          actionButton:
            "ml-auto shrink-0 rounded-control px-2 py-1 font-medium text-sheet underline decoration-sheet/40 underline-offset-4 hover:decoration-sheet",
          cancelButton: "shrink-0 text-sheet/75",
          icon: "shrink-0",
        },
      }}
    />
  );
}

export { toast };
