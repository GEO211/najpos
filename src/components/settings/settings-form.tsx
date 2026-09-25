"use client";

import { useState } from "react";
import { updateAccountEmail, updateAccountPassword, updateBeeperEnabled } from "@/app/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/providers/theme-provider";
import { LIMITS } from "@/lib/validation";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils";
import { Bell, BellOff, Moon, Sun } from "lucide-react";

interface SettingsFormProps {
  profile: Profile;
  beeperEnabled: boolean;
}

export function SettingsForm({ profile, beeperEnabled }: SettingsFormProps) {
  const { theme, setTheme, mounted } = useTheme();
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [beeperOn, setBeeperOn] = useState(beeperEnabled);
  const [beeperLoading, setBeeperLoading] = useState(false);
  const [beeperError, setBeeperError] = useState<string | null>(null);

  async function handleEmailSubmit(formData: FormData) {
    setEmailLoading(true);
    setEmailError(null);
    setEmailMessage(null);
    const result = await updateAccountEmail(formData);
    if (result?.error) setEmailError(result.error);
    else setEmailMessage(result.message ?? "Email updated.");
    setEmailLoading(false);
  }

  async function handlePasswordSubmit(formData: FormData) {
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordMessage(null);
    const result = await updateAccountPassword(formData);
    if (result?.error) setPasswordError(result.error);
    else {
      setPasswordMessage(result.message ?? "Password updated.");
      (document.getElementById("password-form") as HTMLFormElement)?.reset();
    }
    setPasswordLoading(false);
  }

  async function handleBeeperChange(enabled: boolean) {
    if (enabled === beeperOn || beeperLoading) return;
    setBeeperLoading(true);
    setBeeperError(null);
    const result = await updateBeeperEnabled(enabled);
    if (result?.error) setBeeperError(result.error);
    else setBeeperOn(enabled);
    setBeeperLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the email you use to sign in.
        </p>

        {emailError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
            {emailError}
          </div>
        )}
        {emailMessage && (
          <div className="mt-4 rounded-md border border-border bg-muted p-3 text-sm text-foreground">
            {emailMessage}
          </div>
        )}

        <form action={handleEmailSubmit} className="mt-5 space-y-4">
          <Input
            name="email"
            label="Email address"
            type="email"
            defaultValue={profile.email}
            maxLength={LIMITS.email}
            required
          />
          <Button type="submit" disabled={emailLoading}>
            {emailLoading ? "Saving..." : "Update email"}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a strong password with at least 6 characters.
        </p>

        {passwordError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
            {passwordError}
          </div>
        )}
        {passwordMessage && (
          <div className="mt-4 rounded-md border border-border bg-muted p-3 text-sm text-foreground">
            {passwordMessage}
          </div>
        )}

        <form
          id="password-form"
          action={handlePasswordSubmit}
          className="mt-5 space-y-4"
        >
          <Input
            name="current_password"
            label="Current password"
            type="password"
            maxLength={LIMITS.password}
            required
            autoComplete="current-password"
          />
          <Input
            name="new_password"
            label="New password"
            type="password"
            minLength={6}
            maxLength={LIMITS.password}
            required
            autoComplete="new-password"
          />
          <Input
            name="confirm_password"
            label="Confirm new password"
            type="password"
            minLength={6}
            maxLength={LIMITS.password}
            required
            autoComplete="new-password"
          />
          <Button type="submit" disabled={passwordLoading}>
            {passwordLoading ? "Saving..." : "Update password"}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Beeper</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign a beeper number during checkout. Off by default — turn on if
          the kitchen uses pagers.
        </p>

        {beeperError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
            {beeperError}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={beeperLoading}
            onClick={() => void handleBeeperChange(false)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors disabled:opacity-60",
              !beeperOn
                ? "border-foreground bg-muted"
                : "border-border hover:bg-muted/60"
            )}
          >
            <BellOff className="h-5 w-5 text-foreground" strokeWidth={1.5} />
            <span className="text-sm font-medium text-foreground">Disabled</span>
          </button>
          <button
            type="button"
            disabled={beeperLoading}
            onClick={() => void handleBeeperChange(true)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors disabled:opacity-60",
              beeperOn
                ? "border-foreground bg-muted"
                : "border-border hover:bg-muted/60"
            )}
          >
            <Bell className="h-5 w-5 text-foreground" strokeWidth={1.5} />
            <span className="text-sm font-medium text-foreground">Enabled</span>
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Theme</h2>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
            Beta
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose light or dark appearance for the app. Theme support is in beta
          and may not apply consistently across all screens yet.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
              mounted && theme === "light"
                ? "border-foreground bg-muted"
                : "border-border hover:bg-muted/60"
            )}
          >
            <Sun className="h-5 w-5 text-foreground" strokeWidth={1.5} />
            <span className="text-sm font-medium text-foreground">Light</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
              mounted && theme === "dark"
                ? "border-foreground bg-muted"
                : "border-border hover:bg-muted/60"
            )}
          >
            <Moon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
            <span className="text-sm font-medium text-foreground">Dark</span>
          </button>
        </div>
      </section>
    </div>
  );
}
