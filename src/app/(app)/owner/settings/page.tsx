import { requireAuth } from "@/lib/auth";
import { SettingsForm } from "@/components/settings/settings-form";
import { getBeeperEnabled } from "@/lib/store-settings";

export default async function SettingsPage() {
  const profile = await requireAuth();
  const beeperEnabled = await getBeeperEnabled();

  return (
    <div className="p-8">
      <div className="mb-8 border-b border-border pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account, POS, and appearance
        </p>
      </div>

      <SettingsForm profile={profile} beeperEnabled={beeperEnabled} />
    </div>
  );
}
