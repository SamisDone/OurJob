"use client";

import { GearSixIcon, SignOutIcon } from "@phosphor-icons/react/ssr";
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
export function AccountMenu({ user, collapsed = false }: { user: AccountUser; collapsed?: boolean }) {
  const { signOut, pending } = useSignOut();
  const name = displayName(user);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "rail-center flex h-11 w-full items-center gap-3 rounded-control px-3 text-left text-sm text-body hover:bg-ink-wash data-[state=open]:bg-ink-wash",
          collapsed && "justify-center px-0",
        )}
        aria-label={`Account: ${name}`}
      >
        <Avatar user={user} />
        <span className={cn("rail-label min-w-0 flex-1 truncate", collapsed && "sr-only")}>{name}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={6}
          className="relative z-50 min-w-56 rounded-panel border red-rule-top border-rule bg-sheet p-1 pt-2 text-body shadow-pop data-[state=open]:animate-[pop-in_200ms_var(--ease-ink)]"
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
