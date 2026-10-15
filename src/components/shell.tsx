"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, CalendarDays, Home, Menu, Settings, SunMedium, Repeat } from "lucide-react";

const desktop = [
  { href: "/home", label: "Dashboard", icon: Home },
  { href: "/today", label: "My Day", icon: SunMedium },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobile = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/today", label: "Today", icon: SunMedium },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Insights", icon: BarChart3 },
  { href: "/more", label: "More", icon: Menu },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell md:grid md:grid-cols-[240px_1fr]">
      <aside className="sidebar hidden md:flex md:flex-col md:gap-2 md:p-4">
        <div className="px-2 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">PEACE MODE</p>
          <p className="mt-2 text-sm text-muted">Protect your peace.</p>
        </div>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {desktop.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link" data-active={pathname === item.href || pathname.startsWith(`${item.href}/`)}>
              <item.icon aria-hidden className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 px-4 pb-28 pt-6 md:px-8 md:pb-16 md:pt-8">
        <div id="content" className="mx-auto w-full max-w-6xl">{children}</div>
      </div>
      <nav className="bottom-nav md:hidden" aria-label="Mobile">
        {mobile.map((item) => (
          <Link key={item.href} href={item.href} className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted" data-active={pathname === item.href} aria-current={pathname === item.href ? "page" : undefined}>
            <item.icon aria-hidden className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageTitle({ kicker, title, text }: { kicker?: string; title: string; text?: string }) {
  return (
    <header className="mb-6">
      {kicker ? <p className="text-sm text-muted">{kicker}</p> : null}
      <h1 className="mt-1 text-[clamp(1.7rem,4vw,2.125rem)] font-semibold tracking-tight">{title}</h1>
      {text ? <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted">{text}</p> : null}
    </header>
  );
}

export function Meter({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? 0} aria-label={label}>
      <span style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}
