"use client";

import {
  BuildingsIcon,
  DotsThreeIcon,
  FileTextIcon,
  GearSixIcon,
  KanbanIcon,
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
  SunHorizonIcon,
  UserCircleIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/overlay";
import { setStored, useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";
import { CommandPalette, Kbd } from "./command-palette";
import { Wordmark } from "./wordmark";

type NavItem = { href: string; label: string; icon: Icon };

const primary: NavItem[] = [
  { href: "/today", label: "Today", icon: SunHorizonIcon },
  { href: "/tailor", label: "Tailor", icon: FileTextIcon },
  { href: "/tracker", label: "Tracker", icon: KanbanIcon },
  { href: "/companies", label: "Companies", icon: BuildingsIcon },
];

const secondary: NavItem[] = [
  { href: "/profile", label: "Profile", icon: UserCircleIcon },
  { href: "/settings", label: "Settings", icon: GearSixIcon },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RailLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const I = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-control px-3 text-sm transition-colors duration-[120ms] ease-ink",
        active ? "font-medium text-ink" : "text-graphite hover:bg-ink-wash hover:text-ink",
        collapsed && "justify-center px-0",
      )}
    >
      {active && <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-[2px] bg-ink" aria-hidden />}
      <I size={20} aria-hidden weight={active ? "fill" : "regular"} className="shrink-0" />
      <span className={cn(collapsed && "sr-only")}>{item.label}</span>
    </Link>
  );
}

/**
 * Rail on desktop (220 px, collapsible to 64 px), bottom bar on phones.
 * The page itself carries the content; the chrome stays quiet.
 */
export function AppShell({ children, user }: { children: ReactNode; user?: { name?: string | null } }) {
  const pathname = usePathname() ?? "";
  const collapsed = useStored("ourjob-rail", "open") === "collapsed";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const toggle = () => setStored("ourjob-rail", collapsed ? "open" : "collapsed");

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-sheet focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <nav
        aria-label="Main"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-rule bg-paper px-3 py-4 md:flex",
          "transition-[width] duration-200 ease-ink",
          collapsed ? "w-16" : "w-[220px] max-lg:w-16",
        )}
      >
        <div className={cn("flex h-10 items-center px-3", collapsed && "justify-center px-0")}>
          <span className={cn(collapsed ? "hidden" : "max-lg:hidden")}>
            <Wordmark />
          </span>
          <span className={cn(collapsed ? "inline" : "hidden max-lg:inline")}>
            <Wordmark compact />
          </span>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "mt-4 flex h-9 items-center gap-2 rounded-control border border-rule px-3 text-sm text-graphite hover:border-graphite hover:text-ink",
            (collapsed && "justify-center px-0") || "max-lg:justify-center max-lg:px-0",
          )}
          aria-label="Open command palette"
        >
          <MagnifyingGlassIcon size={16} aria-hidden />
          <span className={cn("flex-1 text-left", collapsed ? "sr-only" : "max-lg:sr-only")}>Search</span>
          <span className={cn(collapsed ? "hidden" : "max-lg:hidden")}>
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>

        <ul className="mt-5 space-y-0.5">
          {primary.map((item) => (
            <li key={item.href}>
              <RailLink item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
            </li>
          ))}
        </ul>

        <ul className="mt-auto space-y-0.5">
          {secondary.map((item) => (
            <li key={item.href}>
              <RailLink item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
            </li>
          ))}
          <li className="max-lg:hidden">
            <button
              type="button"
              onClick={toggle}
              aria-pressed={collapsed}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-control px-3 text-sm text-graphite hover:bg-ink-wash hover:text-ink",
                collapsed && "justify-center px-0",
              )}
            >
              <SidebarSimpleIcon size={20} aria-hidden />
              <span className={cn(collapsed && "sr-only")}>{collapsed ? "Expand menu" : "Collapse menu"}</span>
            </button>
          </li>
        </ul>
        {user?.name && !collapsed && (
          <p className="mt-3 truncate px-3 text-xs text-graphite max-lg:hidden">{user.name}</p>
        )}
      </nav>

      <main id="main" className="min-w-0 flex-1 pb-24 md:pb-0">
        {children}
      </main>

      {/* Phone bottom bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-rule bg-sheet pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primary.slice(0, 3).map((item) => {
          const I = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-16 flex-col items-center justify-center gap-1 text-xs",
                active ? "font-medium text-ink" : "text-graphite",
              )}
            >
              {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-[2px] bg-ink" aria-hidden />}
              <I size={22} aria-hidden weight={active ? "fill" : "regular"} />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex h-16 flex-col items-center justify-center gap-1 text-xs text-graphite"
        >
          <DotsThreeIcon size={22} aria-hidden />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent title="More">
          <ul className="-mx-3 space-y-0.5">
            {[primary[3], ...secondary].map((item) => {
              const I = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex h-12 items-center gap-3 rounded-control px-3 text-base text-ink hover:bg-ink-wash"
                  >
                    <I size={20} aria-hidden className="text-graphite" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
