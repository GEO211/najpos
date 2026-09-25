import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

await client.query(`
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'void'
`);

await client.query(`
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
  $$ LANGUAGE plpgsql SECURITY DEFINER
`);

await client.query(`
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
  $$ LANGUAGE plpgsql SECURITY DEFINER
`);

console.log("Order void migration complete");

await client.end();
