import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

// Geist Sans for everything in the app.
export const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

// Geist Mono only for numbers (scores, pay, dates, times) and the LaTeX source.
export const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

// Latin Modern Roman, the same design as the Computer Modern his LaTeX CV
// renders in. Only the CV preview uses it. Subset and license notes: src/fonts/latin-modern/.
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

export const fontVariables = [geistSans.variable, geistMono.variable, lmRoman.variable, lmCaps.variable].join(" ");
