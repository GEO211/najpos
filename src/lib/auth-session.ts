import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const REMEMBER_ME_COOKIE = "haliya-remember-me";
export const REMEMBER_UNTIL_COOKIE = "haliya-remember-until";
export const REMEMBER_DURATION_SECONDS = 30 * 24 * 60 * 60;

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export function parseRememberMe(formData: FormData): boolean {
  return formData.get("remember_me") === "on";
}

export function isRememberSession(cookies: CookieReader): boolean {
  return cookies.get(REMEMBER_ME_COOKIE)?.value === "1";
}

export function getRememberUntil(cookies: CookieReader): number | null {
  const raw = cookies.get(REMEMBER_UNTIL_COOKIE)?.value;
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function isRememberExpired(until: number | null): boolean {
  return until !== null && Date.now() > until;
}

export function isSupabaseAuthCookie(name: string): boolean {
  return name.includes("-auth-token");
}

const baseCookieOptions: Partial<ResponseCookie> = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

export function buildAuthCookieOptions(rememberMe: boolean): Partial<ResponseCookie> {
  if (!rememberMe) {
    return { ...baseCookieOptions };
  }

  return {
    ...baseCookieOptions,
    maxAge: REMEMBER_DURATION_SECONDS,
  };
}

export function applyRememberToAuthCookies<
  T extends { name: string; value: string; options: Partial<ResponseCookie> },
>(cookiesToSet: T[], rememberMe: boolean): T[] {
  const authOptions = buildAuthCookieOptions(rememberMe);

  return cookiesToSet.map((cookie) =>
    isSupabaseAuthCookie(cookie.name)
      ? { ...cookie, options: { ...cookie.options, ...authOptions } }
      : cookie
  );
}

export function rememberCookieOptions(): Partial<ResponseCookie> {
  return {
    ...baseCookieOptions,
    maxAge: REMEMBER_DURATION_SECONDS,
  };
}

export function setRememberCookies(
  setCookie: (name: string, value: string, options: Partial<ResponseCookie>) => void
) {
  const options = rememberCookieOptions();
  const until = String(Date.now() + REMEMBER_DURATION_SECONDS * 1000);
  setCookie(REMEMBER_ME_COOKIE, "1", options);
  setCookie(REMEMBER_UNTIL_COOKIE, until, options);
}

export function clearRememberCookies(
  deleteCookie: (name: string) => void
) {
  deleteCookie(REMEMBER_ME_COOKIE);
  deleteCookie(REMEMBER_UNTIL_COOKIE);
}
