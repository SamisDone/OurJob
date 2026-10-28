"use client";

import { useCallback, useLayoutEffect, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const fieldBase = [
  "w-full min-w-0 rounded-control border border-control-edge bg-sheet text-body placeholder:text-graphite",
  "transition-[border-color] duration-[120ms] ease-ink hover:border-ink/60",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-redpen",
];

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldBase, "h-10 px-3 text-base max-md:h-11 md:text-sm", className)}
      {...props}
    />
  );
}

type TextareaProps = ComponentProps<"textarea"> & {
  /** Grow with content up to this many pixels, then scroll. */
  maxHeight?: number;
};

export function Textarea({ className, maxHeight = 640, onInput, ...props }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, maxHeight)}px`;
  }, [maxHeight]);

  useLayoutEffect(resize, [resize, props.value]);

  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      onInput={(e) => {
        resize();
        onInput?.(e);
      }}
      className={cn(fieldBase, "min-h-24 resize-none px-3 py-2.5 text-base leading-6", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-body", className)} {...props} />;
}

export function FieldHint({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-graphite", className)} {...props} />;
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return <p role="alert" className={cn("text-sm text-redpen", className)} {...props} />;
}
