import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

await client.query(`
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
`);

console.log("Updated handle_new_user trigger function");
await client.end();
