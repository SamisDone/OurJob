"use client";

import { Tabs as TabsPrimitive, ToggleGroup } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex items-end gap-5 border-b border-rule", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex h-10 items-center border-b-2 border-transparent text-sm font-medium text-graphite",
        "transition-colors duration-[120ms] ease-ink hover:text-ink",
        "data-[state=active]:border-ink data-[state=active]:text-ink max-md:h-11",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("pt-4 focus-visible:rounded-control", className)} {...props} />;
}

type SegmentedProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  "aria-label": string;
  className?: string;
};

/** Segmented control: one choice from a short set ("Worldwide / My region / Also on-site"). */
export function Segmented({ value, onValueChange, options, className, ...props }: SegmentedProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      aria-label={props["aria-label"]}
      className={cn("inline-flex max-w-full rounded-control border border-control-edge bg-paper p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            "h-8 shrink-0 rounded-[6px] px-3 text-sm whitespace-nowrap text-graphite transition-colors duration-[120ms] ease-ink max-md:h-11",
            "hover:text-ink data-[state=on]:bg-sheet data-[state=on]:font-medium data-[state=on]:text-ink",
            "data-[state=on]:shadow-[0_0_0_1px_var(--rule)]",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
