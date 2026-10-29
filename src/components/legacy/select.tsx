"use client";

import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react/ssr";
import { Command } from "cmdk";
import { Popover as P, Select as S } from "radix-ui";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

const trigger = [
  "inline-flex h-10 w-full items-center justify-between gap-2 rounded-control border border-control-edge bg-sheet px-3 text-left text-sm text-body",
  "transition-[border-color] duration-[120ms] ease-ink hover:border-ink/60 max-md:h-11",
  "data-[placeholder]:text-graphite",
];

const panel = "z-50 overflow-hidden rounded-panel border border-rule bg-sheet p-1 text-body shadow-pop";
const item = [
  "relative flex h-9 cursor-default select-none items-center gap-2 rounded-[6px] pr-8 pl-3 text-sm outline-none max-md:h-11",
  "data-[highlighted]:bg-ink-wash data-[selected=true]:bg-ink-wash data-[disabled]:opacity-50",
];

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Choose one",
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <S.Root value={value} onValueChange={onValueChange}>
      <S.Trigger id={id} aria-label={ariaLabel} className={cn(trigger, className)}>
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <CaretDownIcon size={16} aria-hidden className="text-graphite" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={6} className={cn(panel, "min-w-[var(--radix-select-trigger-width)]")}>
          <S.Viewport>
            {options.map((o) => (
              <S.Item key={o.value} value={o.value} className={cn(item)}>
                <S.ItemText>{o.label}</S.ItemText>
                <S.ItemIndicator className="absolute right-2.5">
                  <CheckIcon size={16} aria-hidden />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}

/** Searchable single choice, for long lists like countries or timezones. */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Choose one",
  searchPlaceholder = "Search",
  emptyText = "No matches.",
  className,
  "aria-label": ariaLabel,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-placeholder={selected ? undefined : ""}
        className={cn(trigger, className)}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <CaretDownIcon size={16} aria-hidden className="shrink-0 text-graphite" />
      </P.Trigger>
      <P.Portal>
        <P.Content
          sideOffset={6}
          align="start"
          className={cn(panel, "w-[var(--radix-popover-trigger-width)] min-w-64 p-0")}
        >
          <Command>
            <Command.Input
              placeholder={searchPlaceholder}
              className="h-10 w-full border-b border-rule bg-transparent px-3 text-sm text-body placeholder:text-graphite focus-visible:shadow-none focus-visible:outline-none"
            />
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-2 text-sm text-graphite">{emptyText}</Command.Empty>
              {options.map((o) => (
                <Command.Item
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(item)}
                >
                  {o.label}
                  {o.value === value && <CheckIcon size={16} aria-hidden className="absolute right-2.5" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
