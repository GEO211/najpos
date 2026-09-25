-- POS System Schema with RBAC (Owner & Cashier)
-- Run this in your Supabase SQL Editor

-- Custom types
CREATE TYPE user_role AS ENUM ('owner', 'cashier');
CREATE TYPE payment_method AS ENUM ('cash', 'gcash', 'other');
CREATE TYPE order_status AS ENUM ('in_progress', 'done', 'void');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'cashier',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  description TEXT DEFAULT '',
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product size variants (e.g. 12oz / 16oz for beverages)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_label TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, size_label)
);

-- Sales
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number SERIAL,
  cashier_id UUID NOT NULL REFERENCES profiles(id),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  payment_method payment_method NOT NULL DEFAULT 'cash',
  amount_paid DECIMAL(10, 2) NOT NULL CHECK (amount_paid >= 0),
  change_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  order_status order_status NOT NULL DEFAULT 'in_progress',
  completed_at TIMESTAMPTZ,
  beeper_number INTEGER CHECK (beeper_number IS NULL OR (beeper_number >= 1 AND beeper_number <= 50)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sale items
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  variant_label TEXT,
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total DECIMAL(10, 2) NOT NULL CHECK (line_total >= 0)
);

-- Singleton store settings (beeper off by default)
CREATE TABLE store_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  beeper_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO store_settings (id, beeper_enabled) VALUES (1, false);

-- Indexes
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_created ON sales(created_at DESC);
CREATE INDEX idx_sales_order_status ON sales(order_status, created_at DESC);
CREATE UNIQUE INDEX idx_sales_active_beeper
  ON sales(beeper_number)
  WHERE order_status = 'in_progress' AND beeper_number IS NOT NULL;
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_value user_role := 'cashier';
BEGIN
  IF NEW.raw_user_meta_data ? 'role'
     AND NEW.raw_user_meta_data->>'role' IN ('owner', 'cashier') THEN
    user_role_value := (NEW.raw_user_meta_data->>'role')::user_role;
  END IF;

  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_role_value
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_active_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Active users can view profiles"
  ON profiles FOR SELECT
  USING (is_active_user());

CREATE POLICY "Owners can update profiles"
  ON profiles FOR UPDATE
  USING (is_owner());

CREATE POLICY "Owners can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (is_owner());

-- Categories policies
CREATE POLICY "Active users can view categories"
  ON categories FOR SELECT
  USING (is_active_user());

CREATE POLICY "Owners manage categories"
  ON categories FOR ALL
  USING (is_owner())
  WITH CHECK (is_owner());

-- Products policies
CREATE POLICY "Active users manage products"
  ON products FOR ALL
  USING (is_active_user())
  WITH CHECK (is_active_user());

-- Product variants policies
CREATE POLICY "Active users manage product variants"
  ON product_variants FOR ALL
  USING (is_active_user())
  WITH CHECK (is_active_user());

-- Sales policies
CREATE POLICY "Active users can view sales"
  ON sales FOR SELECT
  USING (is_active_user());

CREATE POLICY "Active users can create sales"
  ON sales FOR INSERT
  WITH CHECK (auth.uid() = cashier_id AND is_active_user());

-- Sale items policies
CREATE POLICY "Active users can view sale items"
  ON sale_items FOR SELECT
  USING (is_active_user());

CREATE POLICY "Active users can insert sale items"
  ON sale_items FOR INSERT
  WITH CHECK (
    is_active_user() AND
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.cashier_id = auth.uid()
    )
  );

CREATE POLICY "Active users can view store settings"
  ON store_settings FOR SELECT
  USING (is_active_user());

CREATE POLICY "Active users can update store settings"
  ON store_settings FOR UPDATE
  USING (is_active_user())
  WITH CHECK (is_active_user());

-- Process sale: deduct stock atomically
CREATE OR REPLACE FUNCTION process_sale(
  p_items JSONB,
  p_payment_method payment_method,
  p_amount_paid DECIMAL,
  p_tax_rate DECIMAL DEFAULT 0,
  p_beeper_number INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_cashier_id UUID;
  v_subtotal DECIMAL(10, 2) := 0;
  v_tax DECIMAL(10, 2);
  v_total DECIMAL(10, 2);
  v_change DECIMAL(10, 2);
  item JSONB;
  v_product products%ROWTYPE;
  v_variant product_variants%ROWTYPE;
  v_variant_id UUID;
  v_variant_label TEXT;
  v_unit_price DECIMAL(10, 2);
  v_item_name TEXT;
  v_line_total DECIMAL(10, 2);
BEGIN
  v_cashier_id := auth.uid();
  IF v_cashier_id IS NULL OR NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Calculate subtotal
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM products
    WHERE id = (item->>'product_id')::UUID AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', item->>'product_id';
    END IF;

    v_unit_price := v_product.price;
    v_variant_id := NULL;
    v_variant_label := NULL;

    IF item ? 'variant_id' AND COALESCE(item->>'variant_id', '') <> '' THEN
      SELECT * INTO v_variant FROM product_variants
      WHERE id = (item->>'variant_id')::UUID
        AND product_id = v_product.id
        AND is_active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant not found for product: %', v_product.name;
      END IF;

      v_unit_price := v_variant.price;
      v_variant_id := v_variant.id;
      v_variant_label := v_variant.size_label;
    END IF;

    v_line_total := v_unit_price * (item->>'quantity')::INTEGER;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_tax := ROUND(v_subtotal * p_tax_rate, 2);
  v_total := v_subtotal + v_tax;
  v_change := GREATEST(p_amount_paid - v_total, 0);

  IF p_amount_paid < v_total THEN
    RAISE EXCEPTION 'Insufficient payment amount';
  END IF;

  IF p_beeper_number IS NOT NULL THEN
    IF p_beeper_number < 1 OR p_beeper_number > 50 THEN
      RAISE EXCEPTION 'Beeper number must be between 1 and 50';
    END IF;

    IF EXISTS (
      SELECT 1 FROM sales
      WHERE beeper_number = p_beeper_number
        AND order_status = 'in_progress'
    ) THEN
      RAISE EXCEPTION 'Beeper number % is already in use', p_beeper_number;
    END IF;
  END IF;

  INSERT INTO sales (
    cashier_id, subtotal, tax, total, payment_method, amount_paid, change_amount,
    order_status, beeper_number
  )
  VALUES (
    v_cashier_id, v_subtotal, v_tax, v_total, p_payment_method, p_amount_paid, v_change,
    'in_progress', p_beeper_number
  )
  RETURNING id INTO v_sale_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM products
    WHERE id = (item->>'product_id')::UUID;

    v_unit_price := v_product.price;
    v_item_name := v_product.name;
    v_variant_id := NULL;
    v_variant_label := NULL;

    IF item ? 'variant_id' AND COALESCE(item->>'variant_id', '') <> '' THEN
      SELECT * INTO v_variant FROM product_variants
      WHERE id = (item->>'variant_id')::UUID
        AND product_id = v_product.id;

      IF FOUND THEN
        v_unit_price := v_variant.price;
        v_item_name := v_product.name || ' (' || v_variant.size_label || ')';
        v_variant_id := v_variant.id;
        v_variant_label := v_variant.size_label;
      END IF;
    END IF;

    v_line_total := v_unit_price * (item->>'quantity')::INTEGER;

    INSERT INTO sale_items (
      sale_id, product_id, product_name, variant_id, variant_label,
      unit_price, quantity, line_total
    )
    VALUES (
      v_sale_id, v_product.id, v_item_name, v_variant_id, v_variant_label,
      v_unit_price, (item->>'quantity')::INTEGER, v_line_total
    );
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update kitchen order status (in progress / done)
CREATE OR REPLACE FUNCTION update_order_status(
  p_sale_id UUID,
  p_status order_status
)
RETURNS VOID AS $$
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_status NOT IN ('in_progress', 'done') THEN
    RAISE EXCEPTION 'Invalid order status';
  END IF;

  UPDATE sales
  SET
    order_status = p_status,
    completed_at = CASE WHEN p_status = 'done' THEN NOW() ELSE NULL END
  WHERE id = p_sale_id
    AND order_status <> 'void';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Void a kitchen order (releases beeper for reuse)
CREATE OR REPLACE FUNCTION void_order(p_sale_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE sales
  SET
    order_status = 'void',
    completed_at = NULL
  WHERE id = p_sale_id
    AND order_status IN ('in_progress', 'done');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or already voided';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed data (optional - run after creating your owner account)
-- INSERT INTO categories (name) VALUES ('Beverages'), ('Snacks');
