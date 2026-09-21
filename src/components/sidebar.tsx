"use client";

/**
 * The navigation strip down the left of every screen.
 *
 * It runs in the browser ("use client") for two reasons: it needs to know
 * which page you are on so it can highlight that section, and it can be
 * collapsed to a rail of icons, which is a choice the browser remembers.
 *
 * On a narrow screen it is a rail whatever the choice was - there is no room
 * for anything else - so the choice only decides what happens once there is
 * room for the labels.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { canOpen, ROLE_LABELS, type Role } from "@/lib/roles";
import { signOut } from "@/lib/session-actions";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ClientsIcon,
  DashboardIcon,
  FinanceIcon,
  ReceiptIcon,
  SearchIcon,
  SettingsIcon,
} from "./icons";

const NAV = [
  // Search first: it is the way in when you know what you are after, and
  // everything below it is for when you do not.
  { href: "/search", label: "Search", Icon: SearchIcon },
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/clients", label: "Clients", Icon: ClientsIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/finance", label: "Finance", Icon: FinanceIcon },
  // Under Finance, and hidden with it: canOpen says no to a standard user for
  // this address just as it does for Finance itself.
  { href: "/finance/receipts", label: "Receipts", Icon: ReceiptIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

/** Where the choice is kept, so it survives a reload and a new tab. */
const REMEMBERED = "dennis.sidebar";

/**
 * The open/closed choice, read straight from the browser rather than copied
 * into React state.
 *
 * Done this way because the server has to draw the strip before it can know
 * what the browser remembers. useSyncExternalStore is built for exactly that:
 * the server draws it open, the browser corrects it as it takes over, and
 * neither complains that they disagree. Two tabs stay in step for free,
 * because the storage event is one of the things it listens to.
 */
const watchers = new Set<() => void>();

function subscribe(notify: () => void): () => void {
  watchers.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    watchers.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function isOpen(): boolean {
  try {
    return window.localStorage.getItem(REMEMBERED) !== "closed";
  } catch {
    // Private windows and blocked storage: the strip just stays open.
    return true;
  }
}

/** What the server draws, before any browser has had its say. */
function openOnTheServer(): boolean {
  return true;
}

function remember(open: boolean): void {
  try {
    window.localStorage.setItem(REMEMBERED, open ? "open" : "closed");
  } catch {
    // Nothing to do. The strip still works; it just forgets.
  }
  // Storage events only reach other tabs, so this one is told by hand.
  for (const notify of watchers) notify();
}

export default function Sidebar({
  role,
  name,
}: {
  role: Role;
  /** Who is signed in, shown at the foot so it is never a guess. */
  name: string;
}) {
  const pathname = usePathname();

  const open = useSyncExternalStore(subscribe, isOpen, openOnTheServer);

  // "Wide" means: the choice is open and the screen has room. Everything that
  // only appears in the wide strip hangs off this one class.
  const wide = open ? "hidden lg:block" : "hidden";
  // The same rule the pages use, so the strip can never offer something that
  // would turn you away when you clicked it.
  const sections = NAV.filter((item) => canOpen(role, item.href));

  // Receipts live under Finance, so both match the address when you are on
  // them. The longest match wins, or the strip lights up twice and neither
  // one tells you where you are.
  const current =
    sections
      .filter(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "";

  return (
    <aside
      className={`glass-rail sticky top-0 flex h-screen w-16 shrink-0 flex-col ${
        open ? "lg:w-60" : "lg:w-16"
      }`}
    >
      <div
        className={`flex h-16 items-center gap-3 border-b border-line px-3 ${
          open ? "lg:px-5" : ""
        }`}
      >
        {/* All black, and the only thing in it is the letter: no ring, no
            halo around the tile, nothing on the edge to compete with it. The
            green is in the D and the D alone, lit the way the wordmark beside
            it is. */}
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black text-lg font-bold">
          <span className="neon text-accent">D</span>
        </span>
        {/* The wordmark is hidden on narrow screens, where only icons fit. */}
        <span className={`${wide} min-w-0`}>
          <span className="neon block truncate text-sm font-semibold tracking-wide text-accent">
            Dennis
          </span>
          <span className="block truncate text-xs text-muted">
            D Howell &amp; Sons
          </span>
        </span>
      </div>

      <nav className={`flex-1 space-y-1 p-2 ${open ? "lg:p-3" : ""}`}>
        {sections.map(({ href, label, Icon }) => {
          const here = href === current;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={here ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                here
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              <Icon className="shrink-0" />
              <span className={wide}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* The one control that is about the strip itself rather than about
          where you are going, so it sits apart from the sections. */}
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => remember(!open)}
          aria-expanded={open}
          title={open ? "Hide the menu" : "Show the menu"}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <ChevronLeftIcon
            className={`shrink-0 ${open ? "" : "rotate-180"}`}
          />
          <span className={wide}>Hide menu</span>
        </button>
      </div>

      <div
        className={`border-t border-line px-3 py-3 ${
          open ? "lg:px-5 lg:py-4" : ""
        }`}
      >
        <p className={`${wide} truncate text-xs font-medium`}>{name}</p>
        <p className={`${wide} text-xs text-muted`}>{ROLE_LABELS[role]}</p>
        <form action={signOut}>
          <button
            type="submit"
            title="Sign out"
            className="mt-2 w-full rounded-lg border border-line px-2 py-1.5 text-xs text-muted transition-colors hover:border-danger/50 hover:text-danger"
          >
            <span className={open ? "hidden lg:inline" : "hidden"}>
              Sign out
            </span>
            <span className={open ? "lg:hidden" : ""}>↩</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
