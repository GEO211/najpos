"use client";

import { useState } from "react";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  formatCurrency,
  formatProductPrice,
  getActiveVariants,
  isBeverageCategory,
} from "@/lib/utils";
import { LIMITS } from "@/lib/validation";
import type { Product, Category } from "@/types/database";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

interface ProductManagerProps {
  products: Product[];
  categories: Category[];
  canManageProducts?: boolean;
  canManageCategories?: boolean;
}

export function ProductManager({
  products,
  categories,
  canManageProducts = true,
  canManageCategories = false,
}: ProductManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setError(null);
    const result = await createProduct(formData);
    if (result?.error) setError(result.error);
    else setShowForm(false);
  }

  async function handleUpdate(id: string, formData: FormData) {
    setError(null);
    const result = await updateProduct(id, formData);
    if (result?.error) setError(result.error);
    else setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    const result = await deleteProduct(id);
    if (result?.error) setError(result.error);
  }

  async function handleCreateCategory(formData: FormData) {
    setError(null);
    const result = await createCategory(formData);
    if (result?.error) setError(result.error);
    else setShowCategoryForm(false);
  }

  const categoryOptions = [
    { value: "", label: "No category" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {canManageProducts && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Add Product
          </Button>
        )}
        {canManageCategories && (
          <Button variant="secondary" onClick={() => setShowCategoryForm(!showCategoryForm)}>
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Add Category
          </Button>
        )}
      </div>

      {canManageCategories && showCategoryForm && (
        <form
          action={handleCreateCategory}
          className="mb-6 rounded-lg border border-neutral-200 bg-white p-6"
        >
          <h3 className="mb-4 text-sm font-semibold text-neutral-900">New Category</h3>
          <div className="flex gap-3">
            <Input name="name" label="Category Name" maxLength={LIMITS.categoryName} required className="flex-1" />
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm">Save</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCategoryForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      )}

      {canManageProducts && showForm && (
        <form
          action={handleCreate}
          className="mb-6 rounded-lg border border-neutral-200 bg-white p-6"
        >
          <h3 className="mb-4 text-sm font-semibold text-neutral-900">New Product</h3>
          <ProductForm
            categories={categories}
            categoryOptions={categoryOptions}
            onCancel={() => setShowForm(false)}
          />
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Name</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Category</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Price</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Status</th>
              {canManageProducts && (
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {products.map((product) =>
              canManageProducts && editingId === product.id ? (
                <tr key={product.id}>
                  <td colSpan={5} className="p-4">
                    <form action={(fd) => handleUpdate(product.id, fd)}>
                      <ProductForm
                        product={product}
                        categories={categories}
                        categoryOptions={categoryOptions}
                        onCancel={() => setEditingId(null)}
                      />
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={product.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{product.name}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {(product.categories as Category | null)?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-900">
                    {formatProductPrice(product)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-600">
                      {product.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManageProducts && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingId(product.id)}
                          className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                        >
                          <Pencil className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="p-8 text-center text-sm text-neutral-400">No products yet</p>
        )}
      </div>
    </div>
  );
}

function ProductForm({
  product,
  categories,
  categoryOptions,
  onCancel,
}: {
  product?: Product;
  categories: Category[];
  categoryOptions: { value: string; label: string }[];
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const categoryName =
    selectedCategory?.name ?? (product?.categories as Category | null)?.name ?? null;
  const isBeverage = isBeverageCategory(categoryName);
  const variants = getActiveVariants(product ?? {});

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Input name="name" label="Name" maxLength={LIMITS.productName} defaultValue={product?.name} required />
      <Select
        name="category_id"
        label="Category"
        options={categoryOptions}
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
      />
      {isBeverage ? (
        <>
          <Input
            name="price_12oz"
            label="12oz Price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={variants.find((variant) => variant.size_label === "12oz")?.price}
            required
          />
          <Input
            name="price_16oz"
            label="16oz Price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={variants.find((variant) => variant.size_label === "16oz")?.price}
            required
          />
        </>
      ) : (
        <Input
          name="price"
          label="Price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={product?.price}
          required
        />
      )}
      {product && (
        <Select
          name="is_active"
          label="Status"
          options={[
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
          ]}
          defaultValue={product.is_active ? "true" : "false"}
        />
      )}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm">
          <Check className="mr-1 h-4 w-4" strokeWidth={1.5} />
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="mr-1 h-4 w-4" strokeWidth={1.5} />
          Cancel
        </Button>
      </div>
    </div>
  );
}
