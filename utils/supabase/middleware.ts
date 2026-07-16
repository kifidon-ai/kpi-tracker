import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token"),
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let /login and /auth/callback through always
  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    // Fall through to getUser below so we can bounce already-logged-in users home
  } else if (request.method === "POST" && request.headers.has("next-action")) {
    // Server Actions: skip getUser()/cookie refresh. Refreshing the session on
    // every action rewrites Set-Cookie, which remounts the page, re-fires the
    // mount effects, and loops as POST / 200 forever.
    if (!hasSupabaseSessionCookie(request)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    if (user) return NextResponse.redirect(new URL("/", request.url));
    return response;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}
