"use server";

import { createClient, createServiceClient } from "@/lib/server";
import { requireAuth } from "@/lib/auth";
import { fetchPosCatalogFromDb } from "@/lib/pos-catalog-db";
import { getBeeperEnabled } from "@/lib/store-settings";
import { generateSku, isBeverageCategory } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { Category, Product, OrderStatus } from "@/types/database";
import {
  getFormString,
  parseAdminCode,
  parseAmountPaid,
  parseBooleanFormValue,
  parseCategoryName,
  parseEmail,
  parseFullName,
  parseOptionalBeeperNumber,
  parseOptionalUuid,
  parsePassword,
  parsePaymentMethod,
  parsePrice,
  parseProductName,
  parseSaleItems,
  parseTaxRate,
  parseUserRole,
  parseUuid,
  rejectMalformedForm,
} from "@/lib/validation";

export async function createUser(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentProfile?.role !== "owner") {
    return { error: "Only owners can create users" };
  }

  const malformed = rejectMalformedForm(formData);
  if (malformed) return { error: malformed };

  const adminCodeResult = parseAdminCode(getFormString(formData, "admin_code"));
  if (!adminCodeResult.ok) return { error: adminCodeResult.error };

  const { getAdminCode } = await import("@/lib/constants");

  let expectedAdminCode: string;
  try {
    expectedAdminCode = getAdminCode();
  } catch {
    return { error: "User management is not configured. Contact the store owner." };
  }

  if (adminCodeResult.value !== expectedAdminCode) {
    return { error: "Invalid admin code." };
  }

  const emailResult = parseEmail(getFormString(formData, "email"));
  if (!emailResult.ok) return { error: emailResult.error };

  const passwordResult = parsePassword(getFormString(formData, "password"));
  if (!passwordResult.ok) return { error: passwordResult.error };

  const fullNameResult = parseFullName(getFormString(formData, "full_name"));
  if (!fullNameResult.ok) return { error: fullNameResult.error };

  const roleResult = parseUserRole(getFormString(formData, "role"));
  if (!roleResult.ok) return { error: roleResult.error };

  const { createUserViaDb, hasAdminBackend, useServiceRoleClient } =
    await import("@/lib/admin-users");

  if (!hasAdminBackend()) {
    return {
      error:
        "User management is not configured. Add SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL to .env.local.",
    };
  }

  if (useServiceRoleClient()) {
    const adminClient = await createServiceClient();

    const { data: newUser, error } = await adminClient.auth.admin.createUser({
      email: emailResult.value,
      password: passwordResult.value,
      email_confirm: true,
      user_metadata: {
        full_name: fullNameResult.value,
        role: roleResult.value,
      },
    });

    if (error) return { error: error.message };

    revalidatePath("/owner/users");
    return { success: true, userId: newUser.user.id };
  }

  const result = await createUserViaDb({
    email: emailResult.value,
    password: passwordResult.value,
    fullName: fullNameResult.value,
    role: roleResult.value,
  });
  if ("error" in result) return { error: result.error };

  revalidatePath("/owner/users");
  return { success: true, userId: result.data.userId };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const idResult = parseUuid(userId, "User");
  if (!idResult.ok) return { error: idResult.error };

  if (typeof isActive !== "boolean") {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();

  if (profile?.role !== "owner") return { error: "Unauthorized" };

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", idResult.value);

  if (error) return { error: error.message };

  revalidatePath("/owner/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const idResult = parseUuid(userId, "User");
  if (!idResult.ok) return { error: idResult.error };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentProfile?.role !== "owner") {
    return { error: "Only owners can delete users" };
  }

  if (idResult.value === user.id) {
    return { error: "You cannot delete your own account." };
  }

  const { deleteUserViaDb, hasAdminBackend, useServiceRoleClient } =
    await import("@/lib/admin-users");

  if (!hasAdminBackend()) {
    return {
      error:
        "User management is not configured. Add SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL to .env.local.",
    };
  }

  if (useServiceRoleClient()) {
    const adminClient = await createServiceClient();

    const { data: targetProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", idResult.value)
      .single();

    if (profileError || !targetProfile) {
      return { error: "User not found." };
    }

    if (targetProfile.role === "owner") {
      const { count: ownerCount } = await adminClient
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "owner");

      if ((ownerCount ?? 0) <= 1) {
        return { error: "Cannot delete the only owner account." };
      }
    }

    const { count: salesCount } = await adminClient
      .from("sales")
      .select("*", { count: "exact", head: true })
      .eq("cashier_id", idResult.value);

    if ((salesCount ?? 0) > 0) {
      const { error: deactivateError } = await adminClient
        .from("profiles")
        .update({ is_active: false })
        .eq("id", idResult.value);

      if (deactivateError) return { error: deactivateError.message };

      revalidatePath("/owner/users");
      return {
        success: true,
        message:
          "User has sales history and was deactivated instead of deleted.",
      };
    }

    const { error } = await adminClient.auth.admin.deleteUser(idResult.value);

    if (error) return { error: error.message };

    revalidatePath("/owner/users");
    return { success: true, message: "User deleted successfully." };
  }

  const result = await deleteUserViaDb(idResult.value);
  if ("error" in result) return { error: result.error };

  revalidatePath("/owner/users");
  return { success: true, message: result.data.message };
}

async function syncProductVariants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  categoryName: string | null,
  price12: number,
  price16: number
) {
  await supabase.from("product_variants").delete().eq("product_id", productId);

  if (!isBeverageCategory(categoryName)) return null;

  const { error } = await supabase.from("product_variants").insert([
    { product_id: productId, size_label: "12oz", price: price12 },
    { product_id: productId, size_label: "16oz", price: price16 },
  ]);

  if (error) return error.message;
  return null;
}

export async function createProduct(formData: FormData) {
  const profile = await requireAuth();
  if (profile.role !== "owner" && profile.role !== "cashier") {
    return { error: "Unauthorized" };
  }

  const malformed = rejectMalformedForm(formData);
  if (malformed) return { error: malformed };

  const nameResult = parseProductName(getFormString(formData, "name"));
  if (!nameResult.ok) return { error: nameResult.error };

  const categoryIdResult = parseOptionalUuid(
    getFormString(formData, "category_id")
  );
  if (!categoryIdResult.ok) return { error: categoryIdResult.error };

  const supabase = await createClient();

  let categoryName: string | null = null;
  if (categoryIdResult.value) {
    const { data: category } = await supabase
      .from("categories")
      .select("name")
      .eq("id", categoryIdResult.value)
      .single();
    categoryName = category?.name ?? null;
  }

  const isBeverage = isBeverageCategory(categoryName);
  let price: number;
  let price12: number | null = null;
  let price16: number | null = null;

  if (isBeverage) {
    const price12Result = parsePrice(getFormString(formData, "price_12oz"), "12oz price");
    if (!price12Result.ok) return { error: price12Result.error };
    const price16Result = parsePrice(getFormString(formData, "price_16oz"), "16oz price");
    if (!price16Result.ok) return { error: price16Result.error };
    price12 = price12Result.value;
    price16 = price16Result.value;
    price = Math.min(price12, price16);
  } else {
    const priceResult = parsePrice(getFormString(formData, "price"));
    if (!priceResult.ok) return { error: priceResult.error };
    price = priceResult.value;
  }

  const sku = generateSku(nameResult.value, categoryName);

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: nameResult.value,
      sku,
      description: "",
      price,
      stock: 0,
      category_id: categoryIdResult.value,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (isBeverage && price12 !== null && price16 !== null) {
    const variantError = await syncProductVariants(
      supabase,
      product.id,
      categoryName,
      price12,
      price16
    );
    if (variantError) return { error: variantError };
  }

  revalidatePath("/owner/products");
  revalidatePath("/pos");
  return { success: true };
}

export async function updateProduct(id: string, formData: FormData) {
  const profile = await requireAuth();
  if (profile.role !== "owner" && profile.role !== "cashier") {
    return { error: "Unauthorized" };
  }

  const idResult = parseUuid(id, "Product");
  if (!idResult.ok) return { error: idResult.error };

  const malformed = rejectMalformedForm(formData);
  if (malformed) return { error: malformed };

  const nameResult = parseProductName(getFormString(formData, "name"));
  if (!nameResult.ok) return { error: nameResult.error };

  const categoryIdResult = parseOptionalUuid(
    getFormString(formData, "category_id")
  );
  if (!categoryIdResult.ok) return { error: categoryIdResult.error };

  const isActiveResult = parseBooleanFormValue(
    getFormString(formData, "is_active") ?? "true"
  );
  if (!isActiveResult.ok) return { error: isActiveResult.error };

  const supabase = await createClient();

  let categoryName: string | null = null;
  if (categoryIdResult.value) {
    const { data: category } = await supabase
      .from("categories")
      .select("name")
      .eq("id", categoryIdResult.value)
      .single();
    categoryName = category?.name ?? null;
  }

  const isBeverage = isBeverageCategory(categoryName);
  let price: number;
  let price12: number | null = null;
  let price16: number | null = null;

  if (isBeverage) {
    const price12Result = parsePrice(getFormString(formData, "price_12oz"), "12oz price");
    if (!price12Result.ok) return { error: price12Result.error };
    const price16Result = parsePrice(getFormString(formData, "price_16oz"), "16oz price");
    if (!price16Result.ok) return { error: price16Result.error };
    price12 = price12Result.value;
    price16 = price16Result.value;
    price = Math.min(price12, price16);
  } else {
    const priceResult = parsePrice(getFormString(formData, "price"));
    if (!priceResult.ok) return { error: priceResult.error };
    price = priceResult.value;
  }

  const { error } = await supabase
    .from("products")
    .update({
      name: nameResult.value,
      price,
      category_id: categoryIdResult.value,
      is_active: isActiveResult.value,
    })
    .eq("id", idResult.value);

  if (error) return { error: error.message };

  if (isBeverage && price12 !== null && price16 !== null) {
    const variantError = await syncProductVariants(
      supabase,
      idResult.value,
      categoryName,
      price12,
      price16
    );
    if (variantError) return { error: variantError };
  } else {
    await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", idResult.value);
  }

  revalidatePath("/owner/products");
  revalidatePath("/pos");
  return { success: true };
}

export async function deleteProduct(id: string) {
  const profile = await requireAuth();
  if (profile.role !== "owner" && profile.role !== "cashier") {
    return { error: "Unauthorized" };
  }

  const idResult = parseUuid(id, "Product");
  if (!idResult.ok) return { error: idResult.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", idResult.value);

  if (error) {
    if (error.code === "23503") {
      const { error: deactivateError } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", idResult.value);

      if (deactivateError) return { error: deactivateError.message };

      revalidatePath("/owner/products");
      revalidatePath("/pos");
      return {
        success: true,
        message: "Product has sales history and was deactivated instead of deleted.",
      };
    }

    return { error: error.message };
  }

  revalidatePath("/owner/products");
  revalidatePath("/pos");
  return { success: true };
}

export async function createCategory(formData: FormData) {
  const profile = await requireAuth();
  if (profile.role !== "owner") {
    return { error: "Only owners can create categories" };
  }

  const malformed = rejectMalformedForm(formData);
  if (malformed) return { error: malformed };

  const nameResult = parseCategoryName(getFormString(formData, "name"));
  if (!nameResult.ok) return { error: nameResult.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("categories")
    .insert({ name: nameResult.value });

  if (error) return { error: error.message };

  revalidatePath("/owner/products");
  return { success: true };
}

export async function getPosCatalog(): Promise<
  | { error: string }
  | { products: Product[]; categories: Category[] }
> {
  await requireAuth();

  try {
    return await fetchPosCatalogFromDb();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not load menu from the database.",
    };
  }
}

export async function getActiveBeeperNumbers() {
  await requireAuth();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales")
    .select("beeper_number")
    .eq("order_status", "in_progress")
    .not("beeper_number", "is", null);

  if (error) return { error: error.message };

  const numbers = (data ?? [])
    .map((row) => row.beeper_number)
    .filter((value): value is number => typeof value === "number");

  return { numbers };
}

export async function processSale(
  items: { product_id: string; quantity: number; variant_id?: string | null }[],
  paymentMethod: string,
  amountPaid: number,
  taxRate: number = 0,
  beeperNumber?: number | null
) {
  await requireAuth();

  const itemsResult = parseSaleItems(items);
  if (!itemsResult.ok) return { error: itemsResult.error };

  const paymentResult = parsePaymentMethod(paymentMethod);
  if (!paymentResult.ok) return { error: paymentResult.error };

  const amountResult = parseAmountPaid(amountPaid);
  if (!amountResult.ok) return { error: amountResult.error };

  const taxResult = parseTaxRate(taxRate);
  if (!taxResult.ok) return { error: taxResult.error };

  const beeperEnabled = await getBeeperEnabled();
  let assignedBeeper: number | null = null;

  if (beeperEnabled) {
    const beeperResult = parseOptionalBeeperNumber(beeperNumber);
    if (!beeperResult.ok) return { error: beeperResult.error };
    if (beeperResult.value === null) {
      return { error: "Beeper number is required." };
    }
    assignedBeeper = beeperResult.value;
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("process_sale", {
    p_items: itemsResult.value,
    p_payment_method: paymentResult.value,
    p_amount_paid: amountResult.value,
    p_tax_rate: taxResult.value,
    p_beeper_number: assignedBeeper,
  });

  if (error) return { error: error.message };

  const { data: sale } = await supabase
    .from("sales")
    .select("sale_number")
    .eq("id", data)
    .single();

  revalidatePath("/pos");
  revalidatePath("/owner/sales");
  revalidatePath("/owner/orders");
  revalidatePath("/owner/dashboard");
  return { success: true, saleId: data, saleNumber: sale?.sale_number ?? null };
}

export async function updateOrderStatus(saleId: string, status: OrderStatus) {
  await requireAuth();

  if (status !== "in_progress" && status !== "done") {
    return { error: "Invalid order status." };
  }

  const idResult = parseUuid(saleId);
  if (!idResult.ok) return { error: "Invalid order." };

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_order_status", {
    p_sale_id: idResult.value,
    p_status: status,
  });

  if (error) return { error: error.message };

  revalidatePath("/owner/orders");
  return { success: true };
}

export async function voidOrder(saleId: string) {
  await requireAuth();

  const idResult = parseUuid(saleId);
  if (!idResult.ok) return { error: "Invalid order." };

  const supabase = await createClient();

  const { error } = await supabase.rpc("void_order", {
    p_sale_id: idResult.value,
  });

  if (error) return { error: error.message };

  revalidatePath("/owner/orders");
  revalidatePath("/owner/sales");
  revalidatePath("/owner/dashboard");
  revalidatePath("/pos");
  return { success: true };
}
