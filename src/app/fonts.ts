import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import localFont from "next/font/local";

export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-plex-sans",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

// Latin Modern Roman, the same design as the Computer Modern his LaTeX CV
// renders in. Subset and license notes: src/fonts/latin-modern/.
export const lmRoman = localFont({
  src: [
    { path: "../fonts/latin-modern/ourjob-lmsubset-roman-regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/latin-modern/ourjob-lmsubset-roman-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/latin-modern/ourjob-lmsubset-roman-bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/latin-modern/ourjob-lmsubset-roman-bolditalic.woff2", weight: "700", style: "italic" },
  ],
  display: "swap",
  variable: "--font-lm-roman",
  preload: false,
});

export const lmCaps = localFont({
  src: "../fonts/latin-modern/ourjob-lmsubset-caps-regular.woff2",
  display: "swap",
  variable: "--font-lm-caps",
  preload: false,
});

export const fontVariables = [plexSans.variable, plexMono.variable, lmRoman.variable, lmCaps.variable].join(" ");
