import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

await client.query("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
console.log("Trigger disabled - test signup now, then re-enable");

await client.end();
