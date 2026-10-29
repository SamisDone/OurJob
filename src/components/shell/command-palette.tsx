"use client";

import { FileText, LogOut, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { primaryNav, secondaryNav } from "./nav";

/** Ctrl/Cmd + K. Jump to pages and run actions. */
export function CommandPalette({
  open,
  onOpenChange,
  onRunSearch,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunSearch?: () => void;
  onSignOut?: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn?: () => void) => {
    onOpenChange(false);
    fn?.();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump to a page or run an action"
    >
      <Command loop>
        <CommandInput placeholder="Jump to a page or run an action" />
        <CommandList>
          <CommandEmpty>Nothing matches. Try a page name.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => run(() => router.push("/tailor"))}>
              <FileText />
              Tailor CV
            </CommandItem>
            {onRunSearch && (
              <CommandItem onSelect={() => run(onRunSearch)}>
                <Play />
                Run search now
              </CommandItem>
            )}
            {onSignOut && (
              <CommandItem onSelect={() => run(onSignOut)}>
                <LogOut />
                Sign out
              </CommandItem>
            )}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Go to">
            {[...primaryNav, ...secondaryNav].map((item) => (
              <CommandItem
                key={item.href}
                value={`go ${item.label}`}
                onSelect={() => run(() => router.push(item.href))}
              >
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
