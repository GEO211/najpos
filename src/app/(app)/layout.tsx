import dynamic from "next/dynamic";
import { requireAuth } from "@/lib/auth";

const Sidebar = dynamic(
  () => import("@/components/layout/sidebar").then((mod) => mod.Sidebar),
  { loading: () => null }
);

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar profile={profile} />
      <main className="min-h-0 flex-1 overflow-auto bg-background pt-14">{children}</main>
    </div>
  );
}
