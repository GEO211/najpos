import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

await client.query(`
  DROP POLICY IF EXISTS "Active users can view active products" ON products;
  DROP POLICY IF EXISTS "Owners manage products" ON products;
  DROP POLICY IF EXISTS "Active users can view products" ON products;
  DROP POLICY IF EXISTS "Active users manage products" ON products;

  CREATE POLICY "Active users manage products"
    ON products FOR ALL
    USING (is_active_user())
    WITH CHECK (is_active_user());
`);

await client.query(`
  DROP POLICY IF EXISTS "Active users can view product variants" ON product_variants;
  DROP POLICY IF EXISTS "Owners manage product variants" ON product_variants;
  DROP POLICY IF EXISTS "Active users can view all product variants" ON product_variants;
  DROP POLICY IF EXISTS "Active users manage product variants" ON product_variants;

  CREATE POLICY "Active users manage product variants"
    ON product_variants FOR ALL
    USING (is_active_user())
    WITH CHECK (is_active_user());
`);

console.log("Updated product RLS: cashiers can manage products, not categories.");

await client.end();
