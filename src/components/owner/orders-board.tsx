"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateOrderStatus, voidOrder } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatDate,
  formatOrderStatus,
  formatTransactionId,
} from "@/lib/utils";
import type { OrderStatus, Sale } from "@/types/database";
import type { OrdersPeriod, OrdersStatusCategory } from "@/lib/orders-filters";
import { getOrdersPeriodLabel } from "@/lib/orders-filters";
import { Ban, CheckCircle2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrdersBoardProps {
  pendingOrders: Sale[];
  doneOrders: Sale[];
  period: OrdersPeriod;
  category: OrdersStatusCategory;
}

function OrderCard({
  order,
  isLoading,
  onStatusChange,
  onVoidRequest,
}: {
  order: Sale;
  isLoading: boolean;
  onStatusChange: (saleId: string, status: OrderStatus) => void;
  onVoidRequest: (order: Sale) => void;
}) {
  const isDone = order.order_status === "done";

  return (
    <article
      className={cn(
        "flex flex-col rounded-lg border bg-card shadow-sm",
        isDone ? "border-border" : "border-amber-200 dark:border-amber-900/50"
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-foreground">
              Order #{order.sale_number}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {formatTransactionId(order.sale_number)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {order.beeper_number != null && (
              <span className="rounded-md bg-primary px-2.5 py-1 text-sm font-bold text-primary-foreground">
                Beeper #{order.beeper_number}
              </span>
            )}
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                isDone
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
              )}
            >
              {formatOrderStatus(order.order_status)}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {formatDate(order.created_at)}
          {order.completed_at && isDone
            ? ` · Done ${formatDate(order.completed_at)}`
            : ""}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cashier:{" "}
          {(order.profiles as { full_name?: string })?.full_name || "—"}
        </p>
      </div>

      <ul className="flex-1 space-y-2 px-4 py-3 text-sm">
        {order.sale_items?.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-2"
          >
            <span className="text-foreground">
              <span className="font-medium">{item.quantity}×</span>{" "}
              {item.product_name}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {formatCurrency(Number(item.line_total))}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-2 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            {formatCurrency(Number(order.total))}
          </span>
          {isDone ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => onStatusChange(order.id, "in_progress")}
            >
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
              {isLoading ? "Saving..." : "Reopen"}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={isLoading}
              onClick={() => onStatusChange(order.id, "done")}
            >
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
              {isLoading ? "Saving..." : "Mark done"}
            </Button>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="w-full"
          disabled={isLoading}
          onClick={() => onVoidRequest(order)}
        >
          <Ban className="h-4 w-4" strokeWidth={1.5} />
          Void order
        </Button>
      </div>
    </article>
  );
}

function OrderSection({
  title,
  count,
  orders,
  emptyMessage,
  activeId,
  pending,
  onStatusChange,
  onVoidRequest,
}: {
  title: string;
  count: number;
  orders: Sale[];
  emptyMessage: string;
  activeId: string | null;
  pending: boolean;
  onStatusChange: (saleId: string, status: OrderStatus) => void;
  onVoidRequest: (order: Sale) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isLoading={pending && activeId === order.id}
              onStatusChange={onStatusChange}
              onVoidRequest={onVoidRequest}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function OrdersBoard({
  pendingOrders,
  doneOrders,
  period,
  category,
}: OrdersBoardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const periodLabel = getOrdersPeriodLabel(period).toLowerCase();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(interval);
  }, [router]);

  function handleStatusChange(saleId: string, nextStatus: OrderStatus) {
    setError(null);
    setActiveId(saleId);
    startTransition(async () => {
      const result = await updateOrderStatus(saleId, nextStatus);
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
      setActiveId(null);
    });
  }

  function confirmVoid() {
    if (!voidTarget) return;

    setError(null);
    setActiveId(voidTarget.id);
    startTransition(async () => {
      const result = await voidOrder(voidTarget.id);
      if (result?.error) {
        setError(result.error);
      } else {
        setVoidTarget(null);
        router.refresh();
      }
      setActiveId(null);
    });
  }

  return (
    <div className="space-y-10">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      {(category === "all" || category === "pending") && (
        <OrderSection
          title="Pending"
          count={pendingOrders.length}
          orders={pendingOrders}
          emptyMessage={
            period === "today"
              ? "No pending orders. New POS checkouts will appear here."
              : `No pending orders for ${periodLabel}.`
          }
          activeId={activeId}
          pending={pending}
          onStatusChange={handleStatusChange}
          onVoidRequest={setVoidTarget}
        />
      )}

      {(category === "all" || category === "done") && (
        <OrderSection
          title="Done"
          count={doneOrders.length}
          orders={doneOrders}
          emptyMessage={`No completed orders for ${periodLabel}.`}
          activeId={activeId}
          pending={pending}
          onStatusChange={handleStatusChange}
          onVoidRequest={setVoidTarget}
        />
      )}

      {voidTarget && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-sm:animate-slide-up-in sm:animate-scale-in w-full max-w-sm rounded-t-2xl border border-border bg-card p-6 shadow-lg sm:rounded-lg">
            <h3 className="text-lg font-semibold text-foreground">
              Void order?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Order #{voidTarget.sale_number}
              {voidTarget.beeper_number != null
                ? ` · Beeper #${voidTarget.beeper_number}`
                : ""}{" "}
              will be removed from the queue.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This cannot be undone. The beeper number will be released for new
              orders.
            </p>

            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={pending}
                onClick={() => setVoidTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={pending}
                onClick={confirmVoid}
              >
                {pending ? "Voiding..." : "Void order"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
