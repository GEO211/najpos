import { requireAuth } from "@/lib/auth";
import { PosPageClient } from "@/components/pos/pos-page-client";
import { getBeeperEnabled } from "@/lib/store-settings";

export default async function PosPage() {
  await requireAuth();
  const beeperEnabled = await getBeeperEnabled();

  return <PosPageClient beeperEnabled={beeperEnabled} />;
}
