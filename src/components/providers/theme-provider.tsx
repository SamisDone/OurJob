"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * System, light or dark. next-themes sets .dark on <html> before first paint.
 * The storage key is the one the old theme control used, so a saved choice carries over.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="ourjob-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
