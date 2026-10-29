"use client";

import { Segmented } from "@/components/legacy/tabs";
import { setStored, useStored } from "@/lib/use-stored";

type Theme = "system" | "light" | "dark";

/** Theme: system, light, dark. The choice is applied to <html> before first paint by the root layout. */
export function ThemeControl({ className }: { className?: string }) {
  const stored = useStored("ourjob-theme", "system");
  const theme: Theme = stored === "light" || stored === "dark" ? stored : "system";
  return (
    <Segmented
      aria-label="Theme"
      className={className}
      value={theme}
      onValueChange={(v) => {
        const root = document.documentElement;
        if (v === "system") delete root.dataset.theme;
        else root.dataset.theme = v;
        setStored("ourjob-theme", v);
      }}
      options={[
        { value: "system", label: "System" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
    />
  );
}
