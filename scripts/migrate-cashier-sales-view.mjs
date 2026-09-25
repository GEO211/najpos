import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

await client.query(`
  DROP POLICY IF EXISTS "Cashiers can view own sales" ON sales;
  DROP POLICY IF EXISTS "Active users can view sales" ON sales;

  CREATE POLICY "Active users can view sales"
    ON sales FOR SELECT
    USING (is_active_user());
`);

await client.query(`
  DROP POLICY IF EXISTS "View sale items with sale access" ON sale_items;
  DROP POLICY IF EXISTS "Active users can view sale items" ON sale_items;

  CREATE POLICY "Active users can view sale items"
    ON sale_items FOR SELECT
    USING (is_active_user());
`);

console.log("Updated sales RLS: active users can view all store sales.");

await client.end();
