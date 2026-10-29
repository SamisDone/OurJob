"use client";

import { Search } from "lucide-react";
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
import { activeNavHref, crumbsFor, primaryNav, secondaryNav, type NavItem } from "./nav";
import { useSignOut } from "./sign-out";
import { LogoMark } from "./wordmark";

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

function SiteHeader({ pathname, onSearch }: { pathname: string; onSearch: () => void }) {
  const crumbs = crumbsFor(pathname);
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
      <SidebarTrigger className="-ml-1" aria-label="Toggle menu" />
      {crumbs.length > 0 && (
        <>
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-center" />
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
        <SidebarInset id="main">
          <SiteHeader pathname={pathname} onSearch={() => setPaletteOpen(true)} />
          {children}
        </SidebarInset>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onSignOut={user ? signOut : undefined} />
      </SidebarProvider>
    </QueryProvider>
  );
}
