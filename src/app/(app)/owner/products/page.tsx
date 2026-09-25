import { createClient } from "@/lib/server";
import { requireAuth } from "@/lib/auth";
import { ProductManager } from "@/components/owner/product-manager";

export default async function ProductsPage() {
  const profile = await requireAuth();
  const isOwner = profile.role === "owner";
  const canManageProducts = isOwner || profile.role === "cashier";
  const supabase = await createClient();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*, categories(id, name), product_variants(*)")
      .order("name"),
    supabase.from("categories").select("*").order("name"),
  ]);

  return (
    <div className="p-8">
      <div className="mb-8 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Products
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {canManageProducts
            ? isOwner
              ? "Manage inventory and pricing"
              : "Add and manage products"
            : "View menu and pricing"}
        </p>
      </div>

      <ProductManager
        products={products ?? []}
        categories={categories ?? []}
        canManageProducts={canManageProducts}
        canManageCategories={isOwner}
      />
    </div>
  );
}
