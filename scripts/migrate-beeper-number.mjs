import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

await client.query(`
  ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS beeper_number INTEGER
    CHECK (beeper_number IS NULL OR (beeper_number >= 1 AND beeper_number <= 50))
`);

await client.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_active_beeper
    ON sales(beeper_number)
    WHERE order_status = 'in_progress' AND beeper_number IS NOT NULL
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

    IF p_beeper_number IS NULL OR p_beeper_number < 1 OR p_beeper_number > 50 THEN
      RAISE EXCEPTION 'Beeper number is required';
    END IF;

    IF EXISTS (
      SELECT 1 FROM sales
      WHERE beeper_number = p_beeper_number
        AND order_status = 'in_progress'
    ) THEN
      RAISE EXCEPTION 'Beeper number % is already in use', p_beeper_number;
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

console.log("Beeper number migration complete");

await client.end();
