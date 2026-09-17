"use client";

/**
 * The navigation strip down the left of every screen.
 *
 * It runs in the browser ("use client") for one reason: it needs to know which
 * page you are currently on so it can highlight that section.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { canOpen, ROLE_LABELS, type Role } from "@/lib/roles";
import { signOut } from "@/lib/session-actions";
import {
  CalendarIcon,
  ClientsIcon,
  DashboardIcon,
  FinanceIcon,
  SettingsIcon,
} from "./icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/clients", label: "Clients", Icon: ClientsIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/finance", label: "Finance", Icon: FinanceIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export default function Sidebar({
  role,
  name,
}: {
  role: Role;
  /** Who is signed in, shown at the foot so it is never a guess. */
  name: string;
}) {
  const pathname = usePathname();
  // The same rule the pages use, so the strip can never offer something that
  // would turn you away when you clicked it.
  const sections = NAV.filter((item) => canOpen(role, item.href));

  return (
    <aside className="glass-rail sticky top-0 flex h-screen w-16 shrink-0 flex-col lg:w-60">
      <div className="flex h-16 items-center gap-3 border-b border-line px-3 lg:px-5">
        {/* Black tile, green letter, green ring. The name beside it is the
            only thing on any screen lit as a matter of course rather than
            because a figure needs looking at. */}
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accent/50 bg-black text-base font-bold text-accent shadow-[0_0_11px_-5px_rgba(34,197,94,0.45)]">
          D
        </span>
        {/* The wordmark is hidden on narrow screens, where only icons fit. */}
        <span className="hidden min-w-0 lg:block">
          <span className="neon block truncate text-sm font-semibold tracking-wide text-accent">
            Dennis
          </span>
          <span className="block truncate text-xs text-muted">
            D Howell &amp; Sons
          </span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-2 lg:p-3">
        {sections.map(({ href, label, Icon }) => {
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

      <div className="border-t border-line px-3 py-3 lg:px-5 lg:py-4">
        <p className="hidden truncate text-xs font-medium lg:block">{name}</p>
        <p className="hidden text-xs text-muted lg:block">{ROLE_LABELS[role]}</p>
        <form action={signOut}>
          <button
            type="submit"
            title="Sign out"
            className="mt-2 w-full rounded-lg border border-line px-2 py-1.5 text-xs text-muted transition-colors hover:border-danger/50 hover:text-danger"
          >
            <span className="hidden lg:inline">Sign out</span>
            <span className="lg:hidden">↩</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
