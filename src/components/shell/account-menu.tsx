"use client";

import { CaretDownIcon, GearSixIcon, SignOutIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";
import { useSignOut } from "./sign-out";

export type AccountUser = { name?: string | null; email?: string | null; image?: string | null };

/** The name to show: the Google name, or the part of the email before the @. */
export function displayName(user: AccountUser): string {
  const name = user.name?.trim();
  if (name) return name;
  return user.email?.split("@")[0] ?? "Account";
}

export function Avatar({ user, size = 24 }: { user: AccountUser; size?: number }) {
  const initial = displayName(user).charAt(0).toUpperCase();
  if (user.image) {
    return (
      // Google profile photos come from googleusercontent.com; a plain img avoids
      // configuring next/image remote patterns for one 24 px picture.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-pill border border-rule object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-pill bg-circle-fill text-xs font-semibold text-ink"
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  );
}

const item =
  "flex h-9 cursor-default items-center gap-2.5 rounded-[6px] px-3 text-sm text-body outline-none data-[highlighted]:bg-ink-wash max-md:h-11 [&_svg]:text-graphite";

/** The account item at the bottom of the rail: avatar and name, opening Settings and Sign out. */
export function AccountMenu({
  user,
  collapsed = false,
  variant = "rail",
}: {
  user: AccountUser;
  collapsed?: boolean;
  /** "rail": bottom of the desktop rail. "header": top right of a page without the rail (onboarding). */
  variant?: "rail" | "header";
}) {
  const { signOut, pending } = useSignOut();
  const name = displayName(user);
  const header = variant === "header";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "flex items-center gap-3 rounded-control text-left text-sm text-body hover:bg-ink-wash data-[state=open]:bg-ink-wash",
          header
            ? "h-11 max-w-72 px-2"
            : cn("rail-center h-11 w-full px-3", collapsed && "justify-center px-0"),
        )}
        aria-label={`Account: ${name}`}
      >
        <Avatar user={user} />
        <span
          className={cn(
            "min-w-0 truncate",
            header ? "max-sm:sr-only" : cn("rail-label flex-1", collapsed && "sr-only"),
          )}
        >
          {header ? (user.email ?? name) : name}
        </span>
        {header && <CaretDownIcon size={14} aria-hidden className="shrink-0 text-graphite" />}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={header ? "bottom" : "top"}
          align={header ? "end" : "start"}
          sideOffset={6}
          className="red-rule-top relative z-50 min-w-56 rounded-panel border border-rule bg-sheet p-1 pt-2 text-body shadow-pop data-[state=open]:animate-[pop-in_200ms_var(--ease-ink)]"
        >
          {user.email && <p className="truncate px-3 pt-1 pb-2 text-xs text-graphite">{user.email}</p>}
          <DropdownMenu.Item asChild className={item}>
            <Link href="/settings">
              <GearSixIcon size={16} aria-hidden />
              Settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} disabled={pending} onSelect={signOut}>
            <SignOutIcon size={16} aria-hidden />
            {pending ? "Signing out" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
