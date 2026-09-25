import { createClient } from "@/lib/server";
import { requireAuth } from "@/lib/auth";
import { formatCurrency, formatDate, formatTransactionId } from "@/lib/utils";
import {
  buildTopProducts,
  buildWeeklySeries,
  getWeekStart,
} from "@/lib/dashboard-stats";
import { DashboardCharts } from "@/components/owner/dashboard-charts";
import { DollarSign, Package, Receipt } from "lucide-react";

export default async function OwnerDashboard() {
  await requireAuth();
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = getWeekStart();

  const [
    { count: productCount },
    { data: todaySales },
    { data: weekSales },
    { data: recentSales },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("sales")
      .select("total")
      .neq("order_status", "void")
      .gte("created_at", today.toISOString()),
    supabase
      .from("sales")
      .select("total, created_at, sale_items(product_name, quantity)")
      .neq("order_status", "void")
      .gte("created_at", weekStart.toISOString())
      .order("created_at"),
    supabase
      .from("sales")
      .select("*, profiles(full_name, email)")
      .neq("order_status", "void")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const todayRevenue =
    todaySales?.reduce((sum, s) => sum + Number(s.total), 0) ?? 0;
  const todayCount = todaySales?.length ?? 0;

  const weeklyData = buildWeeklySeries(weekSales ?? []);
  const weekSaleItems =
    weekSales?.flatMap(
      (sale) =>
        (sale.sale_items as { product_name: string; quantity: number }[] | null) ??
        []
    ) ?? [];
  const topProducts = buildTopProducts(weekSaleItems);

  const stats = [
    { label: "Today's Revenue", value: formatCurrency(todayRevenue), icon: DollarSign },
    { label: "Today's Sales", value: todayCount.toString(), icon: Receipt },
    { label: "Total Products", value: (productCount ?? 0).toString(), icon: Package },
  ];

  return (
    <div className="min-h-full bg-stone-50 p-8">
      <div className="mb-8 border-b border-stone-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-stone-800">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-stone-500">Store performance overview</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-stone-800">
                  {value}
                </p>
              </div>
              <div className="rounded-md border border-stone-200 bg-stone-50 p-2">
                <Icon className="h-4 w-4 text-[#8B5E3C]" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <DashboardCharts weeklyData={weeklyData} topProducts={topProducts} />

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
          <h2 className="text-sm font-semibold text-stone-800">Recent Sales</h2>
        </div>
        <div className="p-5">
        {recentSales && recentSales.length > 0 ? (
          <div className="divide-y divide-stone-100">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-stone-800">
                      Sale #{sale.sale_number}
                    </p>
                    <span className="rounded border border-stone-200 bg-stone-50 px-2 py-0.5 font-mono text-xs text-stone-600">
                      {formatTransactionId(sale.sale_number)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-stone-500">
                    {formatDate(sale.created_at)} ·{" "}
                    {(sale.profiles as { full_name?: string })?.full_name ||
                      "Cashier"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-[#8B5E3C]">
                  {formatCurrency(Number(sale.total))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">No sales yet</p>
        )}
        </div>
      </div>
    </div>
  );
}
