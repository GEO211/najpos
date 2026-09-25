import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

const fn = await client.query(`
  SELECT pg_get_userbyid(proowner) AS owner
  FROM pg_proc
  WHERE proname = 'handle_new_user'
`);

const rls = await client.query(`
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
  WHERE relname = 'profiles'
`);

const policies = await client.query(`
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE tablename = 'profiles'
`);

console.log("function owner:", fn.rows);
console.log("profiles rls:", rls.rows);
console.log("policies:", policies.rows);

await client.end();
