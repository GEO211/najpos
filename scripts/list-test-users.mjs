import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

const users = await client.query(
  "SELECT email FROM auth.users WHERE email LIKE '%test.com' OR email LIKE '%test'"
);
console.log("test users:", users.rows);

await client.end();
