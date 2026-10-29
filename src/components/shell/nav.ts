import { Building2, FileText, Settings, SquareKanban, Sun, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const primaryNav: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/tailor", label: "Tailor", icon: FileText },
  { href: "/tracker", label: "Tracker", icon: SquareKanban },
  { href: "/companies", label: "Companies", icon: Building2 },
];

/** One tap away on phones, in the bottom bar. The rest is under More. */
export const phoneNav: NavItem[] = primaryNav.slice(0, 3);

export const secondaryNav: NavItem[] = [
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * The nav item a route belongs to. Detail pages light up their parent: a job
 * belongs to Today, a tailored CV to Tailor, onboarding to Profile.
 */
export function activeNavHref(pathname: string): string | null {
  if (under(pathname, "/jobs")) return "/today";
  if (under(pathname, "/onboarding")) return "/profile";
  if (under(pathname, "/preview/today")) return "/today";
  if (under(pathname, "/preview/tailor")) return "/tailor";
  return [...primaryNav, ...secondaryNav].find((item) => under(pathname, item.href))?.href ?? null;
}

export type Crumb = { label: string; href?: string };

/** Breadcrumbs for the header: the section, then the detail page when there is one. */
export function crumbsFor(pathname: string): Crumb[] {
  const href = activeNavHref(pathname);
  const section = [...primaryNav, ...secondaryNav].find((i) => i.href === href);
  if (!section) return [];
  if (under(pathname, "/jobs")) return [{ label: "Today", href: "/today" }, { label: "Job" }];
  if (under(pathname, "/onboarding")) return [{ label: "Profile", href: "/profile" }, { label: "Set up" }];
  if (pathname.startsWith("/tailor/")) return [{ label: "Tailor", href: "/tailor" }, { label: "Tailored CV" }];
  return [{ label: section.label }];
}
