import { Suspense } from "react";
import { createClient } from "@/lib/server";
import { requireAuth } from "@/lib/auth";
import { OrdersBoard } from "@/components/owner/orders-board";
import { OrdersPeriodFilters } from "@/components/owner/orders-period-filters";
import { OrdersStatusFilters } from "@/components/owner/orders-status-filters";
import {
  getOrdersDateFilter,
  getOrdersCategoryLabel,
  getOrdersPeriodLabel,
  parseOrdersCategory,
  parseOrdersPeriod,
  PAST_ORDERS_LIMIT,
} from "@/lib/orders-filters";

type OrdersPageProps = {
  searchParams: Promise<{ period?: string; status?: string }>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  await requireAuth();
  const params = await searchParams;
  const period = parseOrdersPeriod(params);
  const category = parseOrdersCategory(params);
  const periodLabel = getOrdersPeriodLabel(period);
  const categoryLabel = getOrdersCategoryLabel(category);
  const dateFilter = getOrdersDateFilter(period);

  const supabase = await createClient();
  const select = "*, profiles(full_name, email), sale_items(*)" as const;

  const pendingBase = () =>
    supabase
      .from("sales")
      .select(select)
      .eq("order_status", "in_progress");

  const doneBase = () =>
    supabase.from("sales").select(select).eq("order_status", "done");

  function applyDate<T extends ReturnType<typeof pendingBase>>(query: T) {
    if (dateFilter.type === "range") {
      return query
        .gte("created_at", dateFilter.start)
        .lt("created_at", dateFilter.end);
    }
    return query.lt("created_at", dateFilter.before);
  }

  const fetchPending = category === "all" || category === "pending";
  const fetchDone = category === "all" || category === "done";

  let pendingQuery = fetchPending ? applyDate(pendingBase()) : null;
  let doneQuery = fetchDone ? applyDate(doneBase()) : null;

  if (period === "past") {
    if (pendingQuery) pendingQuery = pendingQuery.limit(PAST_ORDERS_LIMIT);
    if (doneQuery) doneQuery = doneQuery.limit(PAST_ORDERS_LIMIT);
  }

  const [pendingResult, doneResult] = await Promise.all([
    pendingQuery
      ? pendingQuery.order("created_at", { ascending: period !== "past" })
      : Promise.resolve({ data: [] }),
    doneQuery
      ? doneQuery.order(
          period === "past" ? "created_at" : "completed_at",
          { ascending: false }
        )
      : Promise.resolve({ data: [] }),
  ]);

  const pendingOrders = pendingResult.data ?? [];
  const doneOrders = doneResult.data ?? [];
  const pendingCount = pendingOrders.length;
  const doneCount = doneOrders.length;

  const summary =
    category === "all"
      ? `${pendingCount} pending · ${doneCount} done`
      : category === "pending"
        ? `${pendingCount} pending`
        : `${doneCount} done`;

  return (
    <div className="p-8">
      <div className="mb-8 border-b border-border pb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Orders
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {periodLabel} · {categoryLabel}: {summary}
                {period === "past" && category === "all"
                  ? ` (latest ${PAST_ORDERS_LIMIT})`
                  : ""}
              </p>
            </div>
            <Suspense fallback={null}>
              <OrdersPeriodFilters />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <OrdersStatusFilters />
          </Suspense>
        </div>
      </div>

      <OrdersBoard
        pendingOrders={pendingOrders}
        doneOrders={doneOrders}
        period={period}
        category={category}
      />
    </div>
  );
}
