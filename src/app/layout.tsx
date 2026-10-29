import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/legacy/toast";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OurJob", template: "%s | OurJob" },
  description: "Tailored CVs and fresh remote jobs, every morning.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1522" },
  ],
};

// Applies the saved theme before first paint. "system" leaves the attribute
// off so tokens.css follows prefers-color-scheme.
const themeScript = `try{var t=localStorage.getItem("ourjob-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
