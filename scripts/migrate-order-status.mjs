import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

await client.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
      CREATE TYPE order_status AS ENUM ('in_progress', 'done');
    END IF;
  END $$
`);

await client.query(`
  ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS order_status order_status NOT NULL DEFAULT 'in_progress'
`);

await client.query(`
  ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ
`);

await client.query(`
  CREATE INDEX IF NOT EXISTS idx_sales_order_status ON sales(order_status, created_at DESC)
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
    WHERE id = p_sale_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order not found';
    END IF;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER
`);

console.log("Order status migration complete");

await client.end();
