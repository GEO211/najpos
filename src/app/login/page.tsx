"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { LIMITS } from "@/lib/validation";

type Mode = "signin" | "register";

const LOGIN_ERRORS: Record<string, string> = {
  session_expired: "Your remembered session has expired. Please sign in again.",
  account_inactive: "Your account has been deactivated.",
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get("error");
    if (code && LOGIN_ERRORS[code]) {
      setError(LOGIN_ERRORS[code]);
    }
  }, [searchParams]);

  async function handleSignIn(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if (result?.redirectTo) {
      router.push(result.redirectTo);
      router.refresh();
      return;
    }
    setLoading(false);
  }

  async function handleSignUp(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(
        result?.message || "Account created. You can sign in now."
      );
      setMode("signin");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo size="lg" priority />
          <p className="mt-4 text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {mode === "signin" ? (
          <form
            action={handleSignIn}
            className="rounded-lg border border-border bg-card p-8"
          >
            {error && (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-5 rounded-md border border-border bg-muted p-3 text-sm text-foreground">
                {success}
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Email"
                name="email"
                type="email"
                placeholder="you@example.com"
                maxLength={LIMITS.email}
                required
              />
              <Input
                label="Password"
                name="password"
                type="password"
                placeholder="••••••••"
                maxLength={LIMITS.password}
                required
              />
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  name="remember_me"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">
                  Remember me for 30 days
                </span>
              </label>
            </div>

            <Button
              type="submit"
              className="mt-6 w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        ) : (
          <form
            action={handleSignUp}
            className="rounded-lg border border-border bg-card p-8"
          >
            {error && (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Admin Code"
                name="admin_code"
                type="password"
                placeholder="Enter admin code"
                maxLength={LIMITS.adminCode}
                required
              />
              <Input
                label="Full Name"
                name="full_name"
                type="text"
                placeholder="Your name"
                maxLength={LIMITS.fullName}
                required
              />
              <Input
                label="Email"
                name="email"
                type="email"
                placeholder="you@example.com"
                maxLength={LIMITS.email}
                required
              />
              <Input
                label="Password"
                name="password"
                type="password"
                placeholder="Min 6 characters"
                maxLength={LIMITS.password}
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="mt-6 w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Account"}
            </Button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Admin code required to register
            </p>
          </form>
        )}

        <div className="mt-6 flex rounded-md border border-border p-1">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 rounded-sm py-2 text-sm font-medium transition-colors ${
              mode === "signin"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 rounded-sm py-2 text-sm font-medium transition-colors ${
              mode === "register"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-sm text-center text-sm text-muted-foreground">
            Loading...
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
