"use client";

import { XIcon } from "@phosphor-icons/react/ssr";
import { Dialog as D, Popover as P, Tooltip as T } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Dialog ------------------------------------------------------------------ */

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

function Overlay({ className }: { className?: string }) {
  return (
    <D.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-scrim",
        "data-[state=closed]:animate-[overlay-out_200ms_var(--ease-ink)] data-[state=open]:animate-[overlay-in_320ms_var(--ease-ink)]",
        className,
      )}
    />
  );
}

type DialogContentProps = ComponentProps<typeof D.Content> & {
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
};

export function DialogContent({ title, description, footer, className, children, ...props }: DialogContentProps) {
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          "fixed top-[12vh] left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2",
          "rounded-panel border border-rule bg-sheet text-ink shadow-pop",
          "data-[state=closed]:animate-[overlay-out_200ms_var(--ease-ink)] data-[state=open]:animate-[dialog-in_320ms_var(--ease-ink)]",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div className="space-y-1">
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            {description ? (
              <D.Description className="text-sm text-graphite">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="-mr-2 inline-flex size-9 items-center justify-center rounded-control text-graphite hover:bg-ink-wash hover:text-ink">
            <XIcon size={16} aria-hidden />
            <span className="sr-only">Close</span>
          </D.Close>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-rule px-6 py-4">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}

/* Sheet: a dialog that slides in from the side (bottom on phones) --------- */

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;

export function SheetContent({ title, description, footer, className, children, ...props }: DialogContentProps) {
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col border-rule bg-sheet text-ink shadow-pop",
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-panel border-t",
          "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-none md:border-t-0 md:border-l",
          "data-[state=open]:animate-[sheet-up_320ms_var(--ease-ink)] md:data-[state=open]:animate-[sheet-in_320ms_var(--ease-ink)]",
          "data-[state=closed]:animate-[overlay-out_200ms_var(--ease-ink)]",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4">
          <div className="space-y-1">
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            {description ? (
              <D.Description className="text-sm text-graphite">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="-mr-2 inline-flex size-9 items-center justify-center rounded-control text-graphite hover:bg-ink-wash hover:text-ink">
            <XIcon size={16} aria-hidden />
            <span className="sr-only">Close</span>
          </D.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-rule px-6 py-4">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}

/* Popover --------------------------------------------------------------- */

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-56 rounded-panel border border-rule bg-sheet p-3 text-ink shadow-pop",
          "data-[state=open]:animate-[pop-in_200ms_var(--ease-ink)]",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}

/* Tooltip --------------------------------------------------------------- */

export const TooltipProvider = T.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <T.Root delayDuration={350}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-72 rounded-control bg-ink px-3 py-2 text-sm text-sheet data-[state=delayed-open]:animate-[pop-in_120ms_var(--ease-ink)]"
        >
          {content}
          <T.Arrow className="fill-ink" width={10} height={5} />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
