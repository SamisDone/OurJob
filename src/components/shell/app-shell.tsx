"use client";

import { Ellipsis, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AccountMenu, type AccountUser } from "./account-menu";
import { CommandPalette } from "./command-palette";
import { activeNavHref, crumbsFor, phoneNav, primaryNav, secondaryNav, type NavItem } from "./nav";
import { useSignOut } from "./sign-out";
import { LogoMark } from "./wordmark";
import { cn } from "@/lib/utils";

function NavGroup({ label, items, active }: { label: string; items: NavItem[]; active: string | null }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={active === item.href} tooltip={item.label}>
                <Link
                  href={item.href}
                  aria-current={active === item.href ? "page" : undefined}
                  onClick={() => isMobile && setOpenMobile(false)}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AppSidebar({ user, active }: { user?: AccountUser; active: string | null }) {
  return (
    <Sidebar collapsible="icon" aria-label="Main">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="OurJob">
              <Link href="/today">
                <LogoMark className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">OurJob</span>
                  <span className="truncate text-xs text-muted-foreground">Remote job search</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Search" items={primaryNav} active={active} />
        <NavGroup label="You" items={secondaryNav} active={active} />
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <AccountMenu user={user} />
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * Phones: Today, Tailor and Tracker one tap away, and More, which opens the
 * Sidebar's sheet with every page and the account menu. More is the active
 * item for the pages that live only in the sheet.
 */
function BottomNav({ active }: { active: string | null }) {
  const { setOpenMobile } = useSidebar();
  const inMore = active !== null && !phoneNav.some((i) => i.href === active);
  const moreLabel = [...primaryNav, ...secondaryNav].find((i) => i.href === active)?.label;
  const item = "h-16 flex-col gap-1 rounded-none text-xs font-normal text-muted-foreground [&_svg]:size-5!";
  const on = "font-medium text-foreground";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {phoneNav.map((i) => (
        <Button key={i.href} asChild variant="ghost" className={cn(item, active === i.href && on)}>
          <Link href={i.href} aria-current={active === i.href ? "page" : undefined}>
            <i.icon />
            {i.label}
          </Link>
        </Button>
      ))}
      <Button
        variant="ghost"
        className={cn(item, inMore && on)}
        data-active={inMore || undefined}
        aria-label={inMore ? `More, current page ${moreLabel}` : "More"}
        onClick={() => setOpenMobile(true)}
      >
        <Ellipsis />
        More
      </Button>
    </nav>
  );
}

function SiteHeader({ pathname, onSearch }: { pathname: string; onSearch: () => void }) {
  const crumbs = crumbsFor(pathname);
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
      {/* Phones open the sheet from More in the bottom bar. */}
      <SidebarTrigger className="-ml-1 hidden md:inline-flex" aria-label="Toggle menu" />
      {crumbs.length > 0 && (
        <>
          <Separator
            orientation="vertical"
            className="mr-2 hidden md:block data-vertical:h-4 data-vertical:self-center"
          />
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((c, i) => (
                <Fragment key={c.label}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {c.href ? (
                      <BreadcrumbLink asChild>
                        <Link href={c.href}>{c.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </>
      )}
      <Button
        variant="outline"
        onClick={onSearch}
        aria-label="Open command palette"
        className="ml-auto w-9 justify-center px-0 text-muted-foreground sm:w-56 sm:justify-start sm:px-2.5"
      >
        <Search />
        <span className="hidden flex-1 text-left font-normal sm:inline">Search</span>
        <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
      </Button>
    </header>
  );
}

/**
 * The one shell for every signed-in page: the shadcn Sidebar (collapsible to
 * icons, a sheet on phones), a header with breadcrumbs, and the command palette.
 */
export function AppShell({
  children,
  user,
  defaultOpen = true,
}: {
  children: ReactNode;
  user?: AccountUser;
  /** From the sidebar cookie, read on the server, so the first paint already has the right width. */
  defaultOpen?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { signOut } = useSignOut();

  return (
    <QueryProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <AppSidebar user={user} active={activeNavHref(pathname)} />
        {/* Room for the phone bottom bar. */}
        <SidebarInset id="main" className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <SiteHeader pathname={pathname} onSearch={() => setPaletteOpen(true)} />
          {children}
        </SidebarInset>
        <BottomNav active={activeNavHref(pathname)} />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onSignOut={user ? signOut : undefined} />
      </SidebarProvider>
    </QueryProvider>
  );
}
