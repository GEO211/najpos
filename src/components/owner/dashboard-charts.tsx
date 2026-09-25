"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { TopProduct, WeeklyPoint } from "@/lib/dashboard-stats";
import { TrendingUp, Trophy } from "lucide-react";

interface DashboardChartsProps {
  weeklyData: WeeklyPoint[];
  topProducts: TopProduct[];
}

const CHART_COLORS = {
  bar: "#8B5E3C",
  barEmpty: "#E8DDD3",
  grid: "#E7E0D8",
  axis: "#8C8178",
};

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: WeeklyPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  return (
    <div className="rounded border border-stone-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-stone-800">{label}</p>
      <p className="text-stone-600">{formatCurrency(point.revenue)}</p>
      <p className="text-xs text-stone-500">
        {point.sales} sale{point.sales === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function DashboardCharts({ weeklyData, topProducts }: DashboardChartsProps) {
  const weekTotal = weeklyData.reduce((sum, day) => sum + day.revenue, 0);
  const weekSales = weeklyData.reduce((sum, day) => sum + day.sales, 0);
  const topFive = topProducts.slice(0, 5);
  const chartData = weeklyData.map((day) => ({
    ...day,
    displayRevenue: day.revenue,
  }));
  const maxRevenue = Math.max(...chartData.map((day) => day.revenue), 0);
  const yAxisMax = maxRevenue > 0 ? maxRevenue : 100;

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-5">
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm lg:col-span-3">
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#8B5E3C]" strokeWidth={1.5} />
            <div>
              <h2 className="text-sm font-semibold text-stone-800">Weekly Sales</h2>
              <p className="text-xs text-stone-500">Last 7 days revenue</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-stone-800">{formatCurrency(weekTotal)}</p>
            <p className="text-xs text-stone-500">{weekSales} transactions</p>
          </div>
        </div>

        <div className="p-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
                  tickFormatter={(value) => `₱${value}`}
                  width={48}
                  domain={[0, yAxisMax]}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: "#F5F0EB" }} />
                <Bar
                  dataKey="displayRevenue"
                  fill={CHART_COLORS.bar}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {weekSales === 0 && (
            <p className="mt-3 text-center text-xs text-stone-400">
              No sales yet this week — chart shows the last 7 days at ₱0
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm lg:col-span-2">
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#8B5E3C]" strokeWidth={1.5} />
            <div>
              <h2 className="text-sm font-semibold text-stone-800">Top 5 Best Sellers</h2>
              <p className="text-xs text-stone-500">This week only</p>
            </div>
          </div>
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs font-medium text-stone-600">
            Top {topFive.length}
          </span>
        </div>

        {topFive.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-white">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                    Rank
                  </th>
                  <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                    Product
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-stone-400">
                    Sold
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {topFive.map((product, index) => (
                  <tr key={product.name} className="hover:bg-stone-50/80">
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          index === 0
                            ? "bg-[#8B5E3C] text-white"
                            : index === 1
                              ? "bg-[#A67C52] text-white"
                              : index === 2
                                ? "bg-stone-300 text-stone-800"
                                : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-stone-800">
                      {product.name}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex min-w-[2.5rem] justify-center rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-semibold text-[#8B5E3C]">
                        {product.quantity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center px-5 text-center">
            <p className="text-sm font-medium text-stone-600">No products sold yet</p>
            <p className="mt-1 text-xs text-stone-400">Top 5 sellers will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
