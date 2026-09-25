import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS store_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    beeper_enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

await client.query(`
  INSERT INTO store_settings (id, beeper_enabled)
  VALUES (1, false)
  ON CONFLICT (id) DO NOTHING
`);

await client.query(`
  ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY
`);

await client.query(`
  DROP POLICY IF EXISTS "Active users can view store settings" ON store_settings;
  DROP POLICY IF EXISTS "Active users can update store settings" ON store_settings;

  CREATE POLICY "Active users can view store settings"
    ON store_settings FOR SELECT
    USING (is_active_user());

  CREATE POLICY "Active users can update store settings"
    ON store_settings FOR UPDATE
    USING (is_active_user())
    WITH CHECK (is_active_user());
`);

await client.query(`
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
  $$ LANGUAGE plpgsql SECURITY DEFINER
`);

const { rows } = await client.query(
  "SELECT beeper_enabled FROM store_settings WHERE id = 1"
);
console.log("Store settings ready. Beeper enabled:", rows[0]?.beeper_enabled);
await client.end();
