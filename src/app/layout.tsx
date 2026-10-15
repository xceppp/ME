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

export const runtime = "nodejs";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let viewer: Awaited<ReturnType<typeof getViewer>> = null;
  try {
    viewer = await getViewer();
  } catch (error) {
    console.error("[peace-mode] startup");
    const message = error instanceof Error ? error.message : "The app could not open its database.";
    return (
      <html lang="en">
        <body style={{ background: "#0B0F14", color: "#F3F5F7", fontFamily: "sans-serif", padding: "2rem" }}>
          <h1>PEACE MODE could not start</h1>
          <p>{message}</p>
        </body>
      </html>
    );
  }
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
