"use client";

import { useState, useMemo, useEffect } from "react";
import { processSale, getActiveBeeperNumbers } from "@/app/actions";
import { BeeperPickerModal } from "@/components/pos/beeper-picker-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPaymentMethod, formatTransactionId, getActiveVariants, cartItemKey, getAddOnProducts, isAddOnProduct, cn } from "@/lib/utils";
import { clampQuantity, LIMITS, sanitizeAmountInput, sanitizeSearchInput } from "@/lib/validation";
import { type ReceiptData } from "@/lib/print-receipt";
import { ReceiptPrintDialog } from "@/components/pos/receipt-print-dialog";
import type { PosCacheMode } from "@/lib/pos-catalog-cache";
import type { Product, Category, CartItem, PaymentMethod, ProductVariant } from "@/types/database";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Banknote,
  CheckCircle,
  Smartphone,
  Printer,
  Loader2,
  WifiOff,
} from "lucide-react";

interface PosTerminalProps {
  products: Product[];
  categories: Category[];
  cacheMode?: PosCacheMode;
  isRefreshing?: boolean;
  isOnline?: boolean;
  beeperEnabled?: boolean;
}

const TAX_RATE = 0;
const SALE_DISMISS_SECONDS = 5;

type PendingAddOnOrder = {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  selectedAddOnIds: string[];
};

export function PosTerminal({
  products,
  categories,
  cacheMode = "live",
  isRefreshing = false,
  isOnline = true,
  beeperEnabled = false,
}: PosTerminalProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{
    total: number;
    change: number;
    beeperNumber: number | null;
  } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [printReceiptAfterSale, setPrintReceiptAfterSale] = useState(false);
  const [sizePickerProduct, setSizePickerProduct] = useState<Product | null>(null);
  const [addOnsPicker, setAddOnsPicker] = useState<PendingAddOnOrder | null>(null);
  const [beeperPicker, setBeeperPicker] = useState<PendingAddOnOrder | null>(null);
  const [beeperCheckoutOpen, setBeeperCheckoutOpen] = useState(false);
  const [beeperNumber, setBeeperNumber] = useState<number | null>(null);
  const [takenBeepers, setTakenBeepers] = useState<number[]>([]);
  const [loadingBeepers, setLoadingBeepers] = useState(false);
  const [addQuantity, setAddQuantity] = useState(1);
  const [pickerQuantity, setPickerQuantity] = useState(1);
  const [saleDismissCountdown, setSaleDismissCountdown] = useState(
    SALE_DISMISS_SECONDS
  );
  const [saleDismissProgress, setSaleDismissProgress] = useState(100);
  const [cartOpen, setCartOpen] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<ReceiptData | null>(null);

  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (!cartOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [cartOpen]);

  useEffect(() => {
    if (!lastSale) return;

    setSaleDismissCountdown(SALE_DISMISS_SECONDS);
    setSaleDismissProgress(100);

    const progressFrame = window.requestAnimationFrame(() => {
      setSaleDismissProgress(0);
    });

    const countdownInterval = window.setInterval(() => {
      setSaleDismissCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const dismissTimer = window.setTimeout(() => {
      setLastSale(null);
      setLastReceipt(null);
    }, SALE_DISMISS_SECONDS * 1000);

    return () => {
      window.cancelAnimationFrame(progressFrame);
      window.clearInterval(countdownInterval);
      window.clearTimeout(dismissTimer);
    };
  }, [lastSale]);

  const addOnProducts = useMemo(
    () => getAddOnProducts(products, categories),
    [products, categories]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (isAddOnProduct(p, categories)) return false;
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || p.category_id === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter, categories]);

  const groupedProducts = useMemo(() => {
    const byCategory = new Map<string, Product[]>();

    for (const product of filteredProducts) {
      const key = product.category_id ?? "uncategorized";
      const list = byCategory.get(key) ?? [];
      list.push(product);
      byCategory.set(key, list);
    }

    function getCategoryName(categoryId: string): string {
      if (categoryId === "uncategorized") return "Others";
      return (
        categories.find((category) => category.id === categoryId)?.name ??
        filteredProducts.find((product) => product.category_id === categoryId)
          ?.categories?.name ??
        "Others"
      );
    }

    if (categoryFilter !== "all") {
      return [
        {
          id: categoryFilter,
          name: getCategoryName(categoryFilter),
          products: byCategory.get(categoryFilter) ?? [],
        },
      ];
    }

    const groups: { id: string; name: string; products: Product[] }[] = [];

    for (const category of categories) {
      const categoryProducts = byCategory.get(category.id);
      if (categoryProducts?.length) {
        groups.push({
          id: category.id,
          name: category.name,
          products: categoryProducts,
        });
        byCategory.delete(category.id);
      }
    }

    for (const [categoryId, categoryProducts] of byCategory.entries()) {
      if (categoryProducts.length > 0) {
        groups.push({
          id: categoryId,
          name: getCategoryName(categoryId),
          products: categoryProducts,
        });
      }
    }

    return groups;
  }, [filteredProducts, categoryFilter, categories]);

  const subtotal = cart.reduce(
    (sum, item) =>
      sum + Number(item.variant?.price ?? item.product.price) * item.quantity,
    0
  );
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  function handleProductClick(product: Product) {
    if (isAddOnProduct(product, categories)) return;

    const variants = getActiveVariants(product);
    if (variants.length > 0) {
      setAddOnsPicker(null);
      setPickerQuantity(addQuantity);
      setSizePickerProduct(product);
      return;
    }
    addToCart(product, null, addQuantity);
  }

  function completePendingAddToCart(picker: PendingAddOnOrder) {
    const { product, variant, quantity, selectedAddOnIds } = picker;
    addToCart(product, variant, quantity);

    for (const addOnId of selectedAddOnIds) {
      const addOn = addOnProducts.find((p) => p.id === addOnId);
      if (addOn) {
        addToCart(addOn, null, quantity);
      }
    }
  }

  async function loadTakenBeepers() {
    setLoadingBeepers(true);
    const result = await getActiveBeeperNumbers();
    setTakenBeepers(result?.numbers ?? []);
    setLoadingBeepers(false);
  }

  function closeBeeperPicker() {
    if (beeperPicker) {
      setAddOnsPicker(beeperPicker);
      setBeeperPicker(null);
      return;
    }
    setBeeperCheckoutOpen(false);
  }

  function selectBeeper(number: number) {
    setBeeperNumber(number);
    setError(null);

    if (beeperPicker) {
      completePendingAddToCart(beeperPicker);
      setBeeperPicker(null);
      return;
    }

    if (beeperCheckoutOpen) {
      setBeeperCheckoutOpen(false);
      setShowConfirm(true);
    }
  }

  function addToCart(
    product: Product,
    variant?: ProductVariant | null,
    quantity = addQuantity
  ) {
    const qty = clampQuantity(quantity);
    setLastSale(null);
    setCart((prev) => {
      const key = cartItemKey({ product, variant });
      const existing = prev.find((item) => cartItemKey(item) === key);
      if (existing) {
        return prev.map((item) =>
          cartItemKey(item) === key
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prev, { product, variant, quantity: qty }];
    });
  }

  function selectSize(variant: ProductVariant) {
    if (!sizePickerProduct) return;
    setAddOnsPicker({
      product: sizePickerProduct,
      variant,
      quantity: pickerQuantity,
      selectedAddOnIds: [],
    });
    setSizePickerProduct(null);
  }

  function toggleAddOn(addOnId: string) {
    setAddOnsPicker((prev) => {
      if (!prev) return prev;
      const selected = prev.selectedAddOnIds.includes(addOnId)
        ? prev.selectedAddOnIds.filter((id) => id !== addOnId)
        : [...prev.selectedAddOnIds, addOnId];
      return { ...prev, selectedAddOnIds: selected };
    });
  }

  function closeOrderPicker() {
    setSizePickerProduct(null);
    setAddOnsPicker(null);
  }

  function backToSizePicker() {
    if (!addOnsPicker) return;
    setSizePickerProduct(addOnsPicker.product);
    setPickerQuantity(addOnsPicker.quantity);
    setAddOnsPicker(null);
  }

  function confirmAddOnsPicker() {
    if (!addOnsPicker) return;

    if (!beeperEnabled || beeperNumber !== null) {
      completePendingAddToCart(addOnsPicker);
      setAddOnsPicker(null);
      return;
    }

    void loadTakenBeepers();
    setBeeperPicker(addOnsPicker);
    setAddOnsPicker(null);
  }

  function updateQuantity(cartKey: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (cartItemKey(item) !== cartKey) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return { ...item, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function setQuantity(cartKey: string, quantity: number) {
    const qty = clampQuantity(quantity);
    setCart((prev) =>
      prev.map((item) =>
        cartItemKey(item) === cartKey ? { ...item, quantity: qty } : item
      )
    );
  }

  function adjustAddQuantity(delta: number) {
    setAddQuantity((prev) => clampQuantity(prev + delta));
  }

  function adjustPickerQuantity(delta: number) {
    setPickerQuantity((prev) => clampQuantity(prev + delta));
  }

  function removeFromCart(cartKey: string) {
    setCart((prev) => prev.filter((item) => cartItemKey(item) !== cartKey));
  }

  function clearCart() {
    setCart([]);
    setAmountPaid("");
    setBeeperNumber(null);
    setLastSale(null);
    setLastReceipt(null);
    setError(null);
  }

  function openCheckoutConfirm() {
    if (cart.length === 0) return;

    const paid = parseFloat(amountPaid) || 0;
    if (paid < total) {
      setError("Insufficient payment amount");
      setCartOpen(true);
      return;
    }

    setError(null);

    if (beeperEnabled && beeperNumber === null) {
      void loadTakenBeepers();
      setBeeperCheckoutOpen(true);
      return;
    }

    setShowConfirm(true);
  }

  function openCart() {
    setCartOpen(true);
  }

  function buildReceiptFromCart(paid: number): ReceiptData {
    return {
      items: cart.map((item) => {
        const unitPrice = Number(item.variant?.price ?? item.product.price);
        const name = item.variant
          ? `${item.product.name} (${item.variant.size_label})`
          : item.product.name;
        return {
          name,
          quantity: item.quantity,
          unitPrice,
          lineTotal: unitPrice * item.quantity,
        };
      }),
      paymentMethod,
      amountPaid: paid,
      total,
      change: Math.max(paid - total, 0),
      date: new Date(),
      beeperNumber: beeperNumber ?? undefined,
    };
  }

  async function confirmCheckout() {
    const paid = parseFloat(amountPaid) || 0;
    const receipt = buildReceiptFromCart(paid);

    if (beeperEnabled && beeperNumber === null) {
      setError("Beeper number is required.");
      return;
    }

    setProcessing(true);
    setError(null);

    const items = cart.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
      variant_id: item.variant?.id ?? null,
    }));

    const result = await processSale(
      items,
      paymentMethod,
      paid,
      TAX_RATE,
      beeperNumber
    );

    if (result?.error) {
      setError(result.error);
      setProcessing(false);
      setShowConfirm(false);
      if (result.error.toLowerCase().includes("beeper")) {
        void loadTakenBeepers();
        setBeeperCheckoutOpen(true);
      }
      return;
    }

    const receiptWithTxn = {
      ...receipt,
      transactionId:
        result.saleNumber != null
          ? formatTransactionId(result.saleNumber)
          : undefined,
    };

    setLastSale({ total, change: paid - total, beeperNumber });
    setLastReceipt(receiptWithTxn);
    setCart([]);
    setAmountPaid("");
    setBeeperNumber(null);
    setProcessing(false);
    setShowConfirm(false);
    setCartOpen(false);

    if (printReceiptAfterSale) {
      setReceiptPreview(receiptWithTxn);
    }
  }

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...categories
      .filter((c) => c.name.toLowerCase() !== "add-ons")
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <>
      <div className="flex h-full min-h-0 flex-col bg-white md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:border-r md:border-neutral-200">
        <div className="border-b border-neutral-200 px-4 py-4 sm:px-6 sm:py-5">
          <h1 className="mb-3 text-base font-semibold tracking-tight text-neutral-900 sm:mb-4 sm:text-lg">
            HALIYA POS
          </h1>
          {(cacheMode === "temp" || !isOnline || isRefreshing) && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                !isOnline || cacheMode === "temp"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-neutral-200 bg-neutral-50 text-neutral-600"
              }`}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <span>Offline — using cached menu. Sales need a connection.</span>
                </>
              ) : cacheMode === "temp" ? (
                <>
                  {isRefreshing ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  )}
                  <span>
                    {isRefreshing
                      ? "Slow connection — showing cached menu while updating..."
                      : "Showing cached menu from this session."}
                  </span>
                </>
              ) : (
                <>
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" strokeWidth={1.5} />
                  <span>Updating menu...</span>
                </>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(sanitizeSearchInput(e.target.value))}
                maxLength={LIMITS.searchQuery}
                className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 sm:w-auto"
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1 sm:w-auto sm:justify-start">
              <span className="text-xs font-medium text-neutral-500">Qty</span>
              <button
                type="button"
                onClick={() => adjustAddQuantity(-1)}
                className="rounded border border-neutral-200 p-1 hover:bg-neutral-50"
                aria-label="Decrease add quantity"
              >
                <Minus className="h-3 w-3" strokeWidth={1.5} />
              </button>
              <input
                type="number"
                min={1}
                value={addQuantity}
                onChange={(event) =>
                  setAddQuantity(Math.max(1, parseInt(event.target.value, 10) || 1))
                }
                className="w-10 border-0 bg-transparent p-0 text-center text-sm font-medium text-neutral-900 outline-none"
              />
              <button
                type="button"
                onClick={() => adjustAddQuantity(1)}
                className="rounded border border-neutral-200 p-1 hover:bg-neutral-50"
                aria-label="Increase add quantity"
              >
                <Plus className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 pb-24 sm:p-6 md:pb-6">
          {groupedProducts.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-400">
              No products found
            </p>
          ) : (
            <div className="space-y-8">
              {groupedProducts.map((group) => (
                <section key={group.id}>
                  <h2 className="mb-3 border-b border-neutral-200 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {group.name}
                  </h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {group.products.map((product) => (
                      <PosProductCard
                        key={product.id}
                        product={product}
                        onSelect={handleProductClick}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label="Close cart"
        className={cn(
          "fade-backdrop fixed inset-0 z-40 bg-black/40 md:hidden",
          cartOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setCartOpen(false)}
      />

      <div
        className={cn(
          "flex flex-col bg-white",
          "max-md:slide-sheet max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:max-h-[min(90dvh,720px)] max-md:rounded-t-2xl max-md:border-t max-md:border-neutral-200 max-md:shadow-2xl",
          cartOpen
            ? "max-md:translate-y-0"
            : "max-md:pointer-events-none max-md:translate-y-full",
          "md:relative md:z-auto md:flex md:h-full md:max-h-none md:w-80 md:shrink-0 md:translate-y-0 md:border-l md:border-neutral-200 md:shadow-none lg:w-96"
        )}
      >
        <button
          type="button"
          aria-label="Close cart"
          onClick={() => setCartOpen(false)}
          className="flex justify-center border-b border-neutral-200 py-3 md:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-neutral-300" />
        </button>

        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 sm:px-5 sm:py-4">
          <ShoppingCart className="h-4 w-4 text-neutral-500" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-neutral-900">
            Cart ({cart.length}{cart.length > 0 ? ` · ${totalUnits} qty` : ""})
          </h2>
          {beeperNumber !== null && (
            <span className="ml-auto rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-semibold text-white">
              Beeper #{beeperNumber}
            </span>
          )}
        </div>

        {lastSale && (
          <div className="mx-4 mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-2 text-neutral-900">
              <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-sm font-semibold">Sale complete</span>
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Total: {formatCurrency(lastSale.total)}
            </p>
            {lastSale.beeperNumber != null && (
              <p className="text-sm font-medium text-neutral-900">
                Beeper #{lastSale.beeperNumber}
              </p>
            )}
            {lastSale.change > 0 && (
              <p className="text-sm font-medium text-neutral-900">
                Change: {formatCurrency(lastSale.change)}
              </p>
            )}
            {lastReceipt && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setReceiptPreview(lastReceipt)}
              >
                <Printer className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Print Receipt
              </Button>
            )}
            <div className="mt-3">
              <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] ease-linear"
                  style={{
                    width: `${saleDismissProgress}%`,
                    transitionDuration: `${SALE_DISMISS_SECONDS}s`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-center text-xs text-neutral-400">
                Clearing in {saleDismissCountdown}s
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">
              Select products to add to cart
            </p>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => {
                const key = cartItemKey(item);
                const unitPrice = Number(item.variant?.price ?? item.product.price);
                const itemName = item.variant
                  ? `${item.product.name} (${item.variant.size_label})`
                  : item.product.name;

                return (
                <div
                  key={key}
                  className="rounded-md border border-neutral-200 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{itemName}</p>
                      <p className="text-xs text-neutral-400">
                        {formatCurrency(unitPrice)} each
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(key)}
                      className="text-neutral-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(key, -1)}
                        className="rounded border border-neutral-200 p-1 hover:bg-neutral-50"
                      >
                        <Minus className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) =>
                          setQuantity(key, parseInt(event.target.value, 10))
                        }
                        className="w-12 rounded border border-neutral-200 px-1 py-1 text-center text-sm font-medium text-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(key, 1)}
                        className="rounded border border-neutral-200 p-1 hover:bg-neutral-50"
                      >
                        <Plus className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {formatCurrency(unitPrice * item.quantity)}
                    </p>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          <div className="mb-4 space-y-2 text-sm">
            <div className="flex justify-between text-neutral-500">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {TAX_RATE > 0 && (
              <div className="flex justify-between text-neutral-500">
                <span>Tax</span>
                <span>{formatCurrency(tax)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold text-neutral-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="mb-4 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md border py-2 text-sm font-medium transition-colors ${
                  paymentMethod === "cash"
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <Banknote className="h-4 w-4" strokeWidth={1.5} />
                Cash
              </button>
              <button
                onClick={() => setPaymentMethod("gcash")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md border py-2 text-sm font-medium transition-colors ${
                  paymentMethod === "gcash"
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <Smartphone className="h-4 w-4" strokeWidth={1.5} />
                GCash
              </button>
            </div>

            <Input
              label="Amount Paid"
              type="number"
              step="0.01"
              min="0"
              max={LIMITS.amountPaid}
              value={amountPaid}
              onChange={(e) => setAmountPaid(sanitizeAmountInput(e.target.value))}
              placeholder={total.toFixed(2)}
            />

            {amountPaid && parseFloat(amountPaid) >= total && (
              <p className="text-sm text-neutral-600">
                Change: {formatCurrency(parseFloat(amountPaid) - total)}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={clearCart} disabled={cart.length === 0}>
              Clear
            </Button>
            <Button
              className="flex-1"
              onClick={openCheckoutConfirm}
              disabled={cart.length === 0 || processing}
            >
              Checkout
            </Button>
          </div>
        </div>
      </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCart}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2.5 text-left"
          >
            <ShoppingCart className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {cart.length > 0
                  ? `${cart.length} item${cart.length === 1 ? "" : "s"} · ${totalUnits} qty`
                  : "Cart empty"}
              </p>
              {beeperNumber !== null && (
                <p className="text-xs text-neutral-500">Beeper #{beeperNumber}</p>
              )}
            </div>
          </button>
          <Button
            className="shrink-0 px-4"
            onClick={() => {
              if (cart.length === 0) {
                openCart();
                return;
              }
              setCartOpen(true);
              openCheckoutConfirm();
            }}
            disabled={cart.length === 0 || processing}
          >
            {formatCurrency(total)}
          </Button>
        </div>
      </div>

      {sizePickerProduct && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-sm:animate-slide-up-in sm:animate-scale-in max-h-[90dvh] w-full overflow-auto rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-lg sm:max-w-sm sm:rounded-lg sm:p-6">
            <h3 className="text-center text-lg font-semibold text-neutral-900">
              Choose size
            </h3>
            <p className="mt-2 text-center text-sm text-neutral-500">
              {sizePickerProduct.name}
            </p>

            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="text-sm text-neutral-500">Quantity</span>
              <button
                type="button"
                onClick={() => adjustPickerQuantity(-1)}
                className="rounded border border-neutral-200 p-1.5 hover:bg-neutral-50"
              >
                <Minus className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <input
                type="number"
                min={1}
                value={pickerQuantity}
                onChange={(event) =>
                  setPickerQuantity(
                    Math.max(1, parseInt(event.target.value, 10) || 1)
                  )
                }
                className="w-14 rounded border border-neutral-200 px-2 py-1.5 text-center text-sm font-medium text-neutral-900"
              />
              <button
                type="button"
                onClick={() => adjustPickerQuantity(1)}
                className="rounded border border-neutral-200 p-1.5 hover:bg-neutral-50"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {getActiveVariants(sizePickerProduct).map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => selectSize(variant)}
                  className="flex items-center justify-between rounded-md border border-neutral-200 px-4 py-3 text-left transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                >
                  <span className="text-sm font-medium text-neutral-900">
                    {variant.size_label}
                  </span>
                  <span className="text-sm font-semibold text-neutral-900">
                    {formatCurrency(Number(variant.price))}
                  </span>
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={closeOrderPicker}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {addOnsPicker && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-sm:animate-slide-up-in sm:animate-scale-in max-h-[90dvh] w-full overflow-auto rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-lg sm:max-w-md sm:rounded-lg sm:p-6">
            <h3 className="text-center text-lg font-semibold text-neutral-900">
              Add-ons
            </h3>
            <p className="mt-2 text-center text-sm text-neutral-500">
              {addOnsPicker.product.name} · {addOnsPicker.variant.size_label} ·{" "}
              {addOnsPicker.quantity}x
            </p>
            <p className="mt-1 text-center text-sm font-medium text-neutral-900">
              {formatCurrency(Number(addOnsPicker.variant.price))} each
            </p>

            {addOnProducts.length === 0 ? (
              <p className="mt-5 text-center text-sm text-neutral-400">
                No add-ons available
              </p>
            ) : (
              <div className="mt-5 max-h-64 space-y-2 overflow-auto">
                {addOnProducts.map((addOn) => {
                  const selected = addOnsPicker.selectedAddOnIds.includes(
                    addOn.id
                  );
                  return (
                    <button
                      key={addOn.id}
                      type="button"
                      onClick={() => toggleAddOn(addOn.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors ${
                        selected
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50"
                      }`}
                    >
                      <span className="text-sm font-medium">{addOn.name}</span>
                      <span className="text-sm font-semibold">
                        +{formatCurrency(Number(addOn.price))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {addOnsPicker.selectedAddOnIds.length > 0 && (
              <p className="mt-4 text-center text-xs text-neutral-500">
                Add-ons total:{" "}
                <span className="font-medium text-neutral-900">
                  {formatCurrency(
                    addOnProducts
                      .filter((p) =>
                        addOnsPicker.selectedAddOnIds.includes(p.id)
                      )
                      .reduce((sum, p) => sum + Number(p.price), 0) *
                      addOnsPicker.quantity
                  )}
                </span>
                {" "}
                ({addOnsPicker.quantity}x drink)
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={backToSizePicker}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={confirmAddOnsPicker}>
                {addOnsPicker.selectedAddOnIds.length > 0
                  ? "Continue"
                  : "Skip add-ons"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <BeeperPickerModal
        open={!!beeperPicker}
        subtitle={
          beeperPicker
            ? `${beeperPicker.product.name} · ${beeperPicker.variant.size_label}`
            : undefined
        }
        takenNumbers={takenBeepers}
        loading={loadingBeepers}
        onSelect={selectBeeper}
        onCancel={closeBeeperPicker}
      />

      <BeeperPickerModal
        open={beeperCheckoutOpen}
        title="Select beeper number"
        subtitle="Assign a beeper before completing checkout."
        takenNumbers={takenBeepers}
        loading={loadingBeepers}
        onSelect={selectBeeper}
        onCancel={closeBeeperPicker}
      />

      {showConfirm && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-sm:animate-slide-up-in sm:animate-scale-in max-h-[90dvh] w-full overflow-auto rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-lg sm:max-w-sm sm:rounded-lg sm:p-6">
            <h3 className="text-center text-lg font-semibold text-neutral-900">
              Are you sure?
            </h3>
            <p className="mt-2 text-center text-sm text-neutral-500">
              Confirm this sale before completing checkout.
            </p>

            <div className="mt-5 space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <div className="space-y-2 border-b border-neutral-200 pb-3">
                {cart.map((item) => {
                  const unitPrice = Number(item.variant?.price ?? item.product.price);
                  const itemName = item.variant
                    ? `${item.product.name} (${item.variant.size_label})`
                    : item.product.name;

                  return (
                    <div key={cartItemKey(item)} className="flex justify-between gap-3">
                      <span className="text-neutral-700">
                        {item.quantity}x {itemName}
                      </span>
                      <span className="shrink-0 font-medium text-neutral-900">
                        {formatCurrency(unitPrice * item.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Items</span>
                <span className="font-medium text-neutral-900">
                  {cart.length} lines · {totalUnits} qty
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Payment</span>
                <span className="font-medium text-neutral-900">
                  {formatPaymentMethod(paymentMethod)}
                </span>
              </div>
              {beeperNumber !== null && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Beeper</span>
                  <span className="font-semibold text-neutral-900">
                    #{beeperNumber}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-500">Amount paid</span>
                <span className="font-medium text-neutral-900">
                  {formatCurrency(parseFloat(amountPaid) || 0)}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-2">
                <span className="font-medium text-neutral-900">Total</span>
                <span className="font-semibold text-neutral-900">
                  {formatCurrency(total)}
                </span>
              </div>
              {parseFloat(amountPaid) > total && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Change</span>
                  <span className="font-medium text-neutral-900">
                    {formatCurrency(parseFloat(amountPaid) - total)}
                  </span>
                </div>
              )}
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={printReceiptAfterSale}
                onChange={(event) => setPrintReceiptAfterSale(event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <Printer className="h-4 w-4 text-neutral-500" strokeWidth={1.5} />
              Print receipt after sale
            </label>

            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowConfirm(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={confirmCheckout}
                disabled={processing}
              >
                {processing ? "Processing..." : "Confirm Sale"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ReceiptPrintDialog
        receipt={receiptPreview}
        onClose={() => setReceiptPreview(null)}
      />
    </>
  );
}

function PosProductCard({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (product: Product) => void;
}) {
  const variants = getActiveVariants(product);

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98] sm:p-4"
    >
      <p className="text-sm font-medium text-neutral-900">{product.name}</p>
      {variants.length > 0 ? (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Available
          </p>
          {variants.map((variant) => (
            <p key={variant.id} className="text-sm text-neutral-800">
              <span className="font-medium">{variant.size_label}</span>
              <span className="mx-1.5 text-neutral-300">—</span>
              <span className="font-semibold text-neutral-900">
                {formatCurrency(Number(variant.price))}
              </span>
            </p>
          ))}
          <p className="pt-0.5 text-xs text-neutral-400">Tap to choose size</p>
        </div>
      ) : (
        <p className="mt-2 text-sm font-semibold text-neutral-900">
          {formatCurrency(Number(product.price))}
        </p>
      )}
    </button>
  );
}
