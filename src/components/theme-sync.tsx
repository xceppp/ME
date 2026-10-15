"use client";

import { useEffect } from "react";

export function ThemeSync({ theme }: { theme: "dark" | "light" | "system" }) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const light = theme === "light" || (theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
      root.dataset.theme = light ? "light" : "dark";
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return null;
}

export function DayRefresh({ date }: { date: string }) {
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      const response = await fetch("/api/local-date", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const body = await response.json() as { date?: string };
      if (body.date && body.date !== date) window.location.reload();
    };
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [date]);
  return null;
}

export function InstallHint() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
