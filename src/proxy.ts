import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the Supabase auth session fresh and does an *optimistic* redirect to
 * /login for protected areas. Real authorisation happens server-side in every
 * admin page, server action and route handler (lib/auth.ts).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const path = request.nextUrl.pathname;
  if (!signedIn && (path.startsWith("/admin") || path.startsWith("/account") || path.startsWith("/bailiff"))) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  // Only paths that need an auth session; public pages stay fully cacheable.
  matcher: ["/admin/:path*", "/account/:path*", "/bailiff/:path*", "/login", "/reset-password", "/permit/verify/:path*", "/catch-returns", "/membership/apply", "/book"],
};
