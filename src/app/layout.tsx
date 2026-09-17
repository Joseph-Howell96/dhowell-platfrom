import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Sidebar from "@/components/sidebar";
import { readSession } from "@/lib/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // The template puts the section name in front on every page, so a browser
  // tab reads "Clients · Dennis" rather than just "Dennis".
  title: {
    default: "Dennis",
    template: "%s · Dennis",
  },
  description: "Internal platform for D Howell & Sons.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read once here rather than in every page, and hand the role down. The
  // sidebar needs it to decide what to show; each page checks it again for
  // itself, because a hidden link is not a closed door.
  const session = await readSession();

  return (
    <html
      lang="en-GB"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {session ? (
          /* The sidebar sits on the left of every screen, the page fills the rest. */
          <div className="flex min-h-screen">
            <Sidebar role={session.role} name={session.displayName} />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        ) : (
          /* Signed out, there is nothing to navigate, so the page has the
             screen to itself. */
          children
        )}
      </body>
    </html>
  );
}
