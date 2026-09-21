/**
 * Keeping a signed-in session alive, and shutting the door on everything else.
 *
 * This file used to be called middleware.ts, which is what every guide to
 * Supabase and Next still says to write. Next 16 renamed it: the convention is
 * `proxy.ts` and the export is `proxy`. Named the old way it is silently not
 * run at all - no error, no warning, just tokens that quietly stop being
 * refreshed and people being thrown out mid-afternoon.
 *
 * Two jobs, in this order.
 *
 * First, refresh. An access token lasts an hour. Calling getUser here spends
 * the refresh token if it needs to and writes the new pair back onto the
 * response, so a page that renders afterwards has a current session. Server
 * Components cannot set cookies, so if this did not happen here it could not
 * happen at all.
 *
 * Second, the door. A request for a real page with nobody signed in is sent to
 * the sign-in screen from here, before any of it renders. That is not the only
 * check and is not meant to be: every page and every action asks again for
 * itself. This one exists so that the answer is no before the work of building
 * a screen has been done - and so that a page added later, by someone who
 * forgot to check, is not open by accident.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** The only places somebody not signed in is allowed to be. */
const OPEN = ["/login"];

export async function proxy(request: NextRequest) {
  // Built now rather than at the end, because the Supabase client writes the
  // refreshed cookies onto it as it goes.
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Nothing configured yet. Let the request through to the page, which will
  // say what is missing in words - far more use than a blank redirect loop.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(incoming) {
        for (const { name, value } of incoming) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of incoming) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isOpen = OPEN.some(
    (open) => path === open || path.startsWith(`${open}/`),
  );

  if (!user && !isOpen) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    // Where they were headed, so signing in carries on rather than dumping
    // everyone on the dashboard. Only the path and query, never a whole URL:
    // taking one of those from the address bar is how an open redirect works.
    const wanted = `${path}${request.nextUrl.search}`;
    if (wanted !== "/" && !wanted.startsWith("//")) {
      login.searchParams.set("next", wanted);
    }
    return NextResponse.redirect(login);
  }

  if (user && path === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  // Everything except Next's own files and the icons, which are served before
  // anyone has signed in and are not worth a database call each.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icon-192.png|icon-512.png|icon-maskable-512.png|manifest.webmanifest).*)",
  ],
};
