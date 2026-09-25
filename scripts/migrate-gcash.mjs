import { createPgClient } from "./load-env.mjs";

const client = createPgClient();

await client.connect();

const check = await client.query(`
  SELECT enumlabel FROM pg_enum
  JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
  WHERE pg_type.typname = 'payment_method'
`);

const labels = check.rows.map((r) => r.enumlabel);
console.log("Current payment_method values:", labels);

if (labels.includes("card")) {
  await client.query(`ALTER TYPE payment_method RENAME VALUE 'card' TO 'gcash'`);
  console.log("Renamed card -> gcash");
} else if (labels.includes("gcash")) {
  console.log("gcash already exists");
} else {
  await client.query(`ALTER TYPE payment_method ADD VALUE 'gcash'`);
  console.log("Added gcash value");
}

await client.end();
