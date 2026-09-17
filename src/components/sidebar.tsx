"use client";

/**
 * The navigation strip down the left of every screen.
 *
 * It runs in the browser ("use client") for one reason: it needs to know which
 * page you are currently on so it can highlight that section.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarIcon,
  ClientsIcon,
  DashboardIcon,
  FinanceIcon,
  OutletsIcon,
  SettingsIcon,
} from "./icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/clients", label: "Clients", Icon: ClientsIcon },
  { href: "/outlets", label: "Outlets", Icon: OutletsIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/finance", label: "Finance", Icon: FinanceIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-line bg-surface lg:w-60">
      <div className="flex h-16 items-center gap-3 border-b border-line px-3 lg:px-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-base font-bold text-canvas">
          D
        </span>
        {/* The wordmark is hidden on narrow screens, where only icons fit. */}
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-sm font-semibold">Dennis</span>
          <span className="block truncate text-xs text-muted">
            D Howell &amp; Sons
          </span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-2 lg:p-3">
        {NAV.map(({ href, label, Icon }) => {
          // A section counts as current if you are on its page or anywhere
          // beneath it, so /clients/new still highlights Clients.
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={current ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                current
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              <Icon className="shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </Link>
          );
        })}
      </nav>

      <p className="hidden border-t border-line px-5 py-4 text-xs text-muted lg:block">
        Internal use only
      </p>
    </aside>
  );
}
