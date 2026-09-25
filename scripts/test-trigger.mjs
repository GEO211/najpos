import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

try {
  await client.query(`SELECT handle_new_user()`);
} catch {
  console.log("direct call failed as expected");
}

try {
  await client.query(
    `INSERT INTO profiles (id, email, full_name, role)
     VALUES (gen_random_uuid(), 'trigger-test@test.com', '', 'cashier')`
  );
  console.log("profile insert ok");
  await client.query(`DELETE FROM profiles WHERE email = 'trigger-test@test.com'`);
} catch (e) {
  console.log("profile insert error:", e.message);
}

const triggers = await client.query(`
  SELECT tgname, tgenabled FROM pg_trigger
  WHERE tgrelid = 'auth.users'::regclass
`);
console.log("triggers on auth.users:", triggers.rows);

await client.end();
