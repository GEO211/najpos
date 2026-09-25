import { Suspense } from "react";
import { createClient } from "@/lib/server";
import { requireAuth } from "@/lib/auth";
import { formatCurrency, formatDate, formatPaymentMethod, formatTransactionId } from "@/lib/utils";
import {
  getSalesDateRange,
  getSalesFilterLabel,
  parseSalesFilter,
} from "@/lib/sales-filters";
import { SalesHistoryFilters } from "@/components/owner/sales-history-filters";

type SalesPageProps = {
  searchParams: Promise<{ period?: string; date?: string }>;
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  await requireAuth();
  const params = await searchParams;
  const filter = parseSalesFilter(params);
  const range = getSalesDateRange(filter);
  const filterLabel = getSalesFilterLabel(filter);

  const supabase = await createClient();

  let query = supabase
    .from("sales")
    .select("*, profiles(full_name, email), sale_items(*)")
    .neq("order_status", "void")
    .order("created_at", { ascending: false });

  if (range) {
    query = query.gte("created_at", range.start).lt("created_at", range.end);
  } else {
    query = query.limit(100);
  }

  const { data: sales } = await query;

  const totalRevenue =
    sales?.reduce((sum, s) => sum + Number(s.total), 0) ?? 0;

  return (
    <div className="p-8">
      <div className="mb-8 border-b border-neutral-200 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
              Sales History
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {sales?.length ?? 0} transactions · Total{" "}
              {formatCurrency(totalRevenue)}
              {filterLabel ? ` · ${filterLabel}` : ""}
            </p>
          </div>
          <Suspense fallback={null}>
            <SalesHistoryFilters />
          </Suspense>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">#</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Transaction ID</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Date</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Cashier</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Items</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Payment</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sales?.map((sale) => (
              <tr key={sale.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-medium text-neutral-900">#{sale.sale_number}</td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                  {formatTransactionId(sale.sale_number)}
                </td>
                <td className="px-4 py-3 text-neutral-500">{formatDate(sale.created_at)}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {(sale.profiles as { full_name?: string })?.full_name || "—"}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {sale.sale_items?.length ?? 0}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {formatPaymentMethod(sale.payment_method)}
                </td>
                <td className="px-4 py-3 font-semibold text-neutral-900">
                  {formatCurrency(Number(sale.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!sales || sales.length === 0) && (
          <p className="p-8 text-center text-sm text-neutral-400">
            {filterLabel
              ? `No sales recorded for ${filterLabel.toLowerCase()}`
              : "No sales recorded yet"}
          </p>
        )}
      </div>
    </div>
  );
}
