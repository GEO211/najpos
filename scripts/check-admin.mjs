import { createPgClient, getEmailArg } from "./load-env.mjs";

const email = getEmailArg();
const client = createPgClient();

await client.connect();
const u = await client.query(
  "SELECT email, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE email = $1",
  [email]
);
console.log("auth.users:", u.rows);
const p = await client.query(
  "SELECT email, role, is_active FROM profiles WHERE email = $1",
  [email]
);
console.log("profiles:", p.rows);
await client.end();
