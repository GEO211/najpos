"use server";

import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  buildAuthRateLimitKey,
  checkAuthRateLimit,
  clearAuthRateLimit,
  getClientIp,
  recordAuthFailure,
} from "@/lib/rate-limit";
import {
  clearRememberCookies,
  parseRememberMe,
  setRememberCookies,
} from "@/lib/auth-session";
import {
  getFormString,
  parseAdminCode,
  parseEmail,
  parseFullName,
  parsePassword,
  rejectMalformedForm,
} from "@/lib/validation";
import { cookies } from "next/headers";

async function enforceAuthRateLimit() {
  const ip = await getClientIp();
  const key = buildAuthRateLimitKey(ip);
  const limit = checkAuthRateLimit(key);

  if (!limit.allowed) {
    return { blocked: true as const, error: limit.message, key };
  }

  return { blocked: false as const, key };
}

export async function signIn(formData: FormData) {
  const rate = await enforceAuthRateLimit();
  if (rate.blocked) {
    return { error: rate.error };
  }

  const malformed = rejectMalformedForm(formData);
  if (malformed) {
    recordAuthFailure(rate.key);
    return { error: malformed };
  }

  const emailResult = parseEmail(getFormString(formData, "email"));
  if (!emailResult.ok) {
    recordAuthFailure(rate.key);
    return { error: emailResult.error };
  }

  const passwordResult = parsePassword(getFormString(formData, "password"));
  if (!passwordResult.ok) {
    recordAuthFailure(rate.key);
    return { error: passwordResult.error };
  }

  const rememberMe = parseRememberMe(formData);
  const supabase = await createClient({ rememberMe });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailResult.value,
    password: passwordResult.value,
  });

  if (error) {
    recordAuthFailure(rate.key);
    const message =
      error.message && error.message !== "{}"
        ? error.message
        : "Invalid email or password.";
    return { error: message };
  }

  if (!data.user) {
    recordAuthFailure(rate.key);
    return { error: "Sign in failed. Please try again." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    recordAuthFailure(rate.key);
    return { error: "User profile not found. Contact the store owner." };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    recordAuthFailure(rate.key);
    return { error: "Your account has been deactivated." };
  }

  const cookieStore = await cookies();
  if (rememberMe) {
    setRememberCookies((name, value, options) =>
      cookieStore.set(name, value, options)
    );
  } else {
    clearRememberCookies((name) => cookieStore.delete(name));
  }

  clearAuthRateLimit(rate.key);
  revalidatePath("/", "layout");

  return {
    success: true,
    redirectTo: profile.role === "owner" ? "/owner/dashboard" : "/pos",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  clearRememberCookies((name) => cookieStore.delete(name));
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function signUp(formData: FormData) {
  const rate = await enforceAuthRateLimit();
  if (rate.blocked) {
    return { error: rate.error };
  }

  const malformed = rejectMalformedForm(formData);
  if (malformed) {
    recordAuthFailure(rate.key);
    return { error: malformed };
  }

  const adminCodeResult = parseAdminCode(getFormString(formData, "admin_code"));
  if (!adminCodeResult.ok) {
    recordAuthFailure(rate.key);
    return { error: adminCodeResult.error };
  }

  const emailResult = parseEmail(getFormString(formData, "email"));
  if (!emailResult.ok) {
    recordAuthFailure(rate.key);
    return { error: emailResult.error };
  }

  const passwordResult = parsePassword(getFormString(formData, "password"));
  if (!passwordResult.ok) {
    recordAuthFailure(rate.key);
    return { error: passwordResult.error };
  }

  const fullNameResult = parseFullName(getFormString(formData, "full_name"), {
    required: false,
  });
  if (!fullNameResult.ok) {
    recordAuthFailure(rate.key);
    return { error: fullNameResult.error };
  }

  const { getAdminCode } = await import("@/lib/constants");

  let expectedAdminCode: string;
  try {
    expectedAdminCode = getAdminCode();
  } catch {
    recordAuthFailure(rate.key);
    return { error: "Registration is not configured. Contact the store owner." };
  }

  if (adminCodeResult.value !== expectedAdminCode) {
    recordAuthFailure(rate.key);
    return { error: "Invalid admin code." };
  }

  const fullName =
    fullNameResult.value ||
    emailResult.value.split("@")[0].slice(0, 100);

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: emailResult.value,
    password: passwordResult.value,
    options: {
      data: {
        full_name: fullName,
        role: "cashier",
      },
    },
  });

  if (error) {
    recordAuthFailure(rate.key);
    const message =
      error.message && error.message !== "{}"
        ? error.message
        : "Could not create account. Please try again.";
    return { error: message };
  }

  if (!data.user) {
    recordAuthFailure(rate.key);
    return { error: "Unable to create account. Please try again." };
  }

  clearAuthRateLimit(rate.key);
  revalidatePath("/", "layout");

  if (!data.session) {
    return {
      success: true,
      message: "Account created. Check your email to confirm, then sign in.",
    };
  }

  return { success: true };
}
