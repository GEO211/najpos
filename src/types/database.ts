export type UserRole = "owner" | "cashier";
export type PaymentMethod = "cash" | "gcash" | "other";
export type OrderStatus = "in_progress" | "done" | "void";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size_label: string;
  price: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  description: string;
  price: number;
  stock: number;
  category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  categories?: Category | null;
  product_variants?: ProductVariant[];
}

export interface Sale {
  id: string;
  sale_number: number;
  cashier_id: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  amount_paid: number;
  change_amount: number;
  order_status: OrderStatus;
  completed_at: string | null;
  beeper_number: number | null;
  created_at: string;
  profiles?: Profile;
  sale_items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  variant_id: string | null;
  variant_label: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface CartItem {
  product: Product;
  variant?: ProductVariant | null;
  quantity: number;
}

export interface DashboardStats {
  totalSales: number;
  totalRevenue: number;
  totalProducts: number;
  lowStockCount: number;
}
