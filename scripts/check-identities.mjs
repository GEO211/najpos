import { createPgClient, getEmailArg } from "./load-env.mjs";

const email = getEmailArg();
const client = createPgClient();

await client.connect();

const userId = (
  await client.query("SELECT id FROM auth.users WHERE email = $1", [email])
).rows[0]?.id;

const identities = await client.query(
  "SELECT * FROM auth.identities WHERE user_id = $1",
  [userId]
);

console.log("identities:", identities.rows);

await client.end();
