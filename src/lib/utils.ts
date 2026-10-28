import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge needs to know our custom scale names so "text-lg" (size) and
// "text-graphite" (color) are not treated as conflicts.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["xs", "sm", "base", "lg", "xl", "2xl", "score"] }],
      "text-color": [
        {
          text: [
            "paper",
            "sheet",
            "ink",
            "graphite",
            "rule",
            "control-edge",
            "highlight",
            "highlight-ink",
            "proofmark",
            "ok",
            "caution",
            "cv-ink",
          ],
        },
      ],
      rounded: [{ rounded: ["control", "panel", "sheet", "pill"] }],
      shadow: [{ shadow: ["sheet", "pop"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
