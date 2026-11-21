"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useTrip } from "../features/trip/store";
import { Icon, type IconName } from "./icons";
import { cx } from "./ui";

const NAV: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Search", icon: "search", match: (p) => p === "/" || p.startsWith("/results") },
  { href: "/trip", label: "Trip", icon: "route", match: (p) => p.startsWith("/trip") || p.startsWith("/checkout") },
  { href: "/orders", label: "Orders", icon: "ticket", match: (p) => p.startsWith("/orders") },
  { href: "/account", label: "Account", icon: "user", match: (p) => p.startsWith("/account") },
];

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("font-display text-[1.625rem] leading-none font-extrabold tracking-[-0.04em]", className)}>
      wayward
      <span aria-hidden="true" className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { items, ready } = useTrip();
  const online = useOnline();
  const count = ready ? items.length : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-lime px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="on-ink sticky top-0 z-40 bg-ink text-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Wayward, search home" className="no-underline">
            <Wordmark />
          </Link>
          <nav aria-label="Main" className="ml-auto hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((n) => {
                const active = n.match(pathname);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "relative flex h-10 items-center gap-2 rounded-md px-3 text-label no-underline transition-colors",
                        active ? "text-white" : "text-ink-muted hover:bg-ink-raised hover:text-white",
                      )}
                    >
                      <Icon name={n.icon} size={18} />
                      {n.label}
                      {n.href === "/trip" && count > 0 ? (
                        <span className="tnum rounded-full bg-lime px-1.5 text-caption font-bold text-ink">
                          {count}
                          <span className="sr-only"> {count === 1 ? "journey" : "journeys"} in trip</span>
                        </span>
                      ) : null}
                      {active ? (
                        <span aria-hidden="true" className="absolute inset-x-3 -bottom-[13px] h-[3px] rounded-full bg-lime" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      {!online ? (
        <div role="status" className="bg-warn-wash text-ink">
          <div className="mx-auto flex max-w-[1200px] items-center gap-2 px-4 py-2 text-body-sm sm:px-6 lg:px-8">
            <Icon name="offline" size={18} className="text-warn" />
            <span>
              <strong>You&apos;re offline.</strong> What you see may be out of date, and prices can&apos;t be checked until you reconnect.
            </span>
          </div>
        </div>
      ) : null}

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-28 outline-none sm:px-6 md:pb-16 lg:px-8">
        {children}
      </main>

      <footer className="hidden border-t border-line md:block">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-4 py-6 text-caption text-text-muted sm:px-6 lg:px-8">
          <span>Good trips. Straight answers.</span>
          <span>A timetable is not a reservation. A payment is not a ticket.</span>
        </div>
      </footer>

      <nav aria-label="Main" className="on-ink fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-ink pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex h-[68px] flex-col items-center justify-center gap-1 text-caption no-underline",
                    active ? "text-white" : "text-ink-muted",
                  )}
                >
                  <span className={cx("relative flex h-8 w-14 items-center justify-center rounded-full transition-colors", active && "bg-lime text-ink")}>
                    <Icon name={n.icon} size={20} />
                    {n.href === "/trip" && count > 0 ? (
                      <span className="tnum absolute -top-1 right-1 min-w-5 rounded-full bg-white px-1 text-center text-[0.6875rem] leading-5 font-bold text-ink">
                        {count}
                      </span>
                    ) : null}
                  </span>
                  {n.label}
                  {n.href === "/trip" && count > 0 ? <span className="sr-only">, {count} in trip</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
