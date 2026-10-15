import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getViewer } from "@/lib/session";
import { ThemeSync } from "@/components/theme-sync";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "PEACE MODE",
  description: "Protect your peace. Build your discipline. Become your best self.",
  applicationName: "PEACE MODE",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PEACE MODE", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0B0F14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const theme = viewer?.profile.preferences.theme ?? "dark";
  const reduced = viewer?.profile.preferences.reducedMotion ? "reduce" : "ok";
  return (
    <html lang="en" className={inter.variable} data-theme={theme === "light" ? "light" : "dark"} data-motion={reduced}>
      <body>
        <a className="skip-link" href="#content">Skip to content</a>
        <ThemeSync theme={theme} />
        {children}
      </body>
    </html>
  );
}
