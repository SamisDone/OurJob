"use client";

import {
  BuildingsIcon,
  FileTextIcon,
  GearSixIcon,
  KanbanIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  SunHorizonIcon,
  UserCircleIcon,
} from "@phosphor-icons/react/ssr";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type Action = { id: string; label: string; icon: ReactNode; shortcut?: string; href?: string; run?: () => void };

const pages: Action[] = [
  { id: "today", label: "Today", icon: <SunHorizonIcon size={16} />, href: "/today" },
  { id: "tailor", label: "Tailor", icon: <FileTextIcon size={16} />, href: "/tailor" },
  { id: "tracker", label: "Tracker", icon: <KanbanIcon size={16} />, href: "/tracker" },
  { id: "companies", label: "Companies", icon: <BuildingsIcon size={16} />, href: "/companies" },
  { id: "profile", label: "Profile", icon: <UserCircleIcon size={16} />, href: "/profile" },
  { id: "settings", label: "Settings", icon: <GearSixIcon size={16} />, href: "/settings" },
];

const item =
  "flex h-10 cursor-default items-center gap-3 rounded-[6px] px-3 text-sm text-body outline-none data-[selected=true]:bg-ink-wash [&_svg]:text-graphite";

/** Ctrl/Cmd + K. Jump to pages, run actions, search jobs and companies. */
export function CommandPalette({
  open: controlledOpen,
  onOpenChange,
  onRunSearch,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRunSearch?: () => void;
}) {
  const router = useRouter();
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const go = (a: Action) => {
    setOpen(false);
    if (a.href) router.push(a.href);
    a.run?.();
  };

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-[overlay-in_200ms_var(--ease-ink)]" />
        <D.Content className="fixed top-[14vh] left-1/2 z-50 w-[min(600px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-panel border border-rule bg-sheet shadow-pop data-[state=open]:animate-[dialog-in_200ms_var(--ease-ink)]">
          <D.Title className="sr-only">Command palette</D.Title>
          <D.Description className="sr-only">Jump to a page or run an action</D.Description>
          <Command loop>
            <div className="flex items-center gap-3 border-b border-rule px-4">
              <MagnifyingGlassIcon size={16} aria-hidden className="text-graphite" />
              <Command.Input
                autoFocus
                placeholder="Jump to a page, run an action, or search jobs"
                className="h-12 w-full bg-transparent text-base text-body placeholder:text-graphite focus-visible:shadow-none focus-visible:outline-none"
              />
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-sm text-graphite">
                Nothing matches. Try a job title or company name.
              </Command.Empty>
              <Command.Group
                heading="Actions"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-graphite"
              >
                <Command.Item className={item} onSelect={() => go({ id: "t", label: "", icon: null, href: "/tailor" })}>
                  <FileTextIcon size={16} aria-hidden />
                  Tailor CV
                </Command.Item>
                <Command.Item
                  className={item}
                  onSelect={() => go({ id: "r", label: "", icon: null, run: onRunSearch })}
                >
                  <PlayIcon size={16} aria-hidden />
                  Run search now
                </Command.Item>
              </Command.Group>
              <Command.Group
                heading="Go to"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-graphite"
              >
                {pages.map((p) => (
                  <Command.Item key={p.id} value={`go ${p.label}`} className={item} onSelect={() => go(p)}>
                    <span aria-hidden>{p.icon}</span>
                    {p.label}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
            <div className="flex gap-4 border-t border-rule px-4 py-2 text-xs text-graphite">
              <span>
                <Kbd>Enter</Kbd> to open
              </span>
              <span>
                <Kbd>Esc</Kbd> to close
              </span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-rule bg-paper px-1 font-sans text-xs text-body">
      {children}
    </kbd>
  );
}
