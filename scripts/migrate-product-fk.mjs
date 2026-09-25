import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

await client.query(`
  ALTER TABLE sale_items
  DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey
`);

await client.query(`
  ALTER TABLE sale_items
  ALTER COLUMN product_id DROP NOT NULL
`);

await client.query(`
  ALTER TABLE sale_items
  ADD CONSTRAINT sale_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
`);

console.log("Updated sale_items.product_id to allow product deletion");

await client.end();
