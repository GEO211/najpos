import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

const processSaleSql = readFileSync(
  resolve(process.cwd(), "supabase", "schema.sql"),
  "utf8"
)
  .split("-- Process sale: deduct stock atomically")[1]
  .split("$$ LANGUAGE plpgsql SECURITY DEFINER;")[0];

await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size_label TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, size_label)
  )
`);

await client.query(`
  ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL
`);

await client.query(`
  ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS variant_label TEXT
`);

await client.query(`
  CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id)
`);

await client.query(`
  ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY
`);

await client.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'product_variants' AND policyname = 'Active users can view product variants'
    ) THEN
      CREATE POLICY "Active users can view product variants"
        ON product_variants FOR SELECT
        USING (is_active_user() AND (is_active = true OR is_owner()));
    END IF;
  END $$
`);

await client.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'product_variants' AND policyname = 'Owners manage product variants'
    ) THEN
      CREATE POLICY "Owners manage product variants"
        ON product_variants FOR ALL
        USING (is_owner())
        WITH CHECK (is_owner());
    END IF;
  END $$
`);

await client.query(`${processSaleSql}$$ LANGUAGE plpgsql SECURITY DEFINER;`);

console.log("Product variants migration complete");

await client.end();
