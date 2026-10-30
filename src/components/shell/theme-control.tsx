"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMounted } from "@/hooks/use-mounted";

/** Theme: system, light, dark. next-themes applies it to <html> before first paint. */
export function ThemeControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render "system" until then.
  const mounted = useMounted();
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label="Theme"
      className={className}
      value={mounted ? (theme ?? "system") : "system"}
      onValueChange={(v) => v && setTheme(v)}
    >
      <ToggleGroupItem value="system">
        <Monitor />
        System
      </ToggleGroupItem>
      <ToggleGroupItem value="light">
        <Sun />
        Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark">
        <Moon />
        Dark
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
