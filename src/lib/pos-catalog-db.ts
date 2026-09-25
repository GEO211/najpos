import type { Category, Product, ProductVariant } from "@/types/database";
import { withPgClient } from "@/lib/db";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function mapVariant(row: Record<string, unknown>): ProductVariant {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    size_label: String(row.size_label),
    price: toNumber(row.price),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

function mapCategory(row: Record<string, unknown> | null): Category | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    created_at: String(row.created_at),
  };
}

function mapProduct(row: Record<string, unknown>): Product {
  const nestedCategory = row.categories as Record<string, unknown> | null;
  const variantsRaw = row.product_variants;
  const variants = Array.isArray(variantsRaw)
    ? variantsRaw.map((variant) =>
        mapVariant(variant as Record<string, unknown>)
      )
    : [];

  return {
    id: String(row.id),
    name: String(row.name),
    sku: row.sku == null ? null : String(row.sku),
    description: row.description == null ? "" : String(row.description),
    price: toNumber(row.price),
    stock: toNumber(row.stock),
    category_id: row.category_id == null ? null : String(row.category_id),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    categories: mapCategory(nestedCategory),
    product_variants: variants,
  };
}

function mapCatalogRows(
  products: unknown[] | null,
  categories: { id: unknown; name: unknown; created_at: unknown }[] | null
): { products: Product[]; categories: Category[] } {
  return {
    products: (products ?? []).map((row) =>
      mapProduct(row as Record<string, unknown>)
    ),
    categories: (categories ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      created_at: String(row.created_at),
    })),
  };
}

async function queryPosCatalog(supabase: {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: boolean) => {
        order: (
          column: string
        ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
      order: (
        column: string
      ) => Promise<{
        data: { id: unknown; name: unknown; created_at: unknown }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
}): Promise<{ products: Product[]; categories: Category[] }> {
  const [
    { data: products, error: productsError },
    { data: categories, error: categoriesError },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*, categories(id, name), product_variants(*)")
      .eq("is_active", true)
      .order("name"),
    supabase.from("categories").select("*").order("name"),
  ]);

  if (productsError || categoriesError) {
    throw new Error(
      productsError?.message ??
        categoriesError?.message ??
        "Could not load menu from Supabase."
    );
  }

  return mapCatalogRows(products, categories);
}

async function fetchPosCatalogViaApi(): Promise<{
  products: Product[];
  categories: Category[];
} | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) return null;

  const { getServiceRoleKey } = await import("@/lib/admin-users");
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return null;

  const { createClient } = await import("@supabase/supabase-js");
  return queryPosCatalog(createClient(supabaseUrl, serviceRoleKey));
}

async function fetchPosCatalogViaSession(): Promise<{
  products: Product[];
  categories: Category[];
}> {
  const { createClient } = await import("@/lib/server");
  return queryPosCatalog(await createClient());
}

async function fetchPosCatalogViaPg(): Promise<{
  products: Product[];
  categories: Category[];
}> {
  return withPgClient(async (client) => {
    const [productsResult, categoriesResult] = await Promise.all([
      client.query(`
        SELECT
          p.id,
          p.name,
          p.sku,
          p.description,
          p.price,
          p.stock,
          p.category_id,
          p.is_active,
          p.created_at,
          p.updated_at,
          CASE
            WHEN c.id IS NULL THEN NULL
            ELSE json_build_object(
              'id', c.id,
              'name', c.name,
              'created_at', c.created_at
            )
          END AS categories,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', pv.id,
                  'product_id', pv.product_id,
                  'size_label', pv.size_label,
                  'price', pv.price,
                  'is_active', pv.is_active,
                  'created_at', pv.created_at
                )
                ORDER BY pv.size_label
              )
              FROM product_variants pv
              WHERE pv.product_id = p.id
            ),
            '[]'::json
          ) AS product_variants
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_active = true
        ORDER BY p.name
      `),
      client.query(
        "SELECT id, name, created_at FROM categories ORDER BY name"
      ),
    ]);

    return {
      products: productsResult.rows.map((row) =>
        mapProduct(row as Record<string, unknown>)
      ),
      categories: categoriesResult.rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        created_at: String(row.created_at),
      })),
    };
  });
}

export async function fetchPosCatalogFromDb(): Promise<{
  products: Product[];
  categories: Category[];
}> {
  try {
    const apiCatalog = await fetchPosCatalogViaApi();
    if (apiCatalog) return apiCatalog;
  } catch {
    // Use the signed-in session on Vercel when the secret key is missing.
  }

  try {
    return await fetchPosCatalogViaSession();
  } catch (sessionError) {
    if (process.env.VERCEL) {
      throw sessionError;
    }
    return fetchPosCatalogViaPg();
  }
}
