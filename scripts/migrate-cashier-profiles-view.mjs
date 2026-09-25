import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

await client.query(`
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Active users can view profiles" ON profiles;

  CREATE POLICY "Active users can view profiles"
    ON profiles FOR SELECT
    USING (is_active_user());
`);

console.log("Updated profiles RLS: cashiers can view names on sales history.");

await client.end();
