import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  applyRememberToAuthCookies,
  clearRememberCookies,
  getRememberUntil,
  isRememberExpired,
  isRememberSession,
} from "@/lib/auth-session";
import { getSupabaseKey } from "@/lib/supabase-key";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const rememberUntil = getRememberUntil(request.cookies);
  if (isRememberExpired(rememberUntil)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "session_expired");
    const response = NextResponse.redirect(url);
    clearRememberCookies((name) => response.cookies.delete(name));
    request.cookies.getAll().forEach(({ name }) => {
      if (name.includes("-auth-token")) {
        response.cookies.delete(name);
      }
    });
    return response;
  }

  const rememberMe = isRememberSession(request.cookies);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabaseKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const adjusted = applyRememberToAuthCookies(cookiesToSet, rememberMe);
          adjusted.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          adjusted.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login");
  const isProtectedRoute =
    pathname.startsWith("/owner") ||
    pathname.startsWith("/pos") ||
    pathname.startsWith("/dashboard");

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === "owner" ? "/owner/dashboard" : "/pos";
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/owner")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!profile?.is_active) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "account_inactive");
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/owner/users") && profile?.role !== "owner") {
      const url = request.nextUrl.clone();
      url.pathname = "/owner/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname.startsWith("/pos")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!profile?.is_active) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "account_inactive");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
