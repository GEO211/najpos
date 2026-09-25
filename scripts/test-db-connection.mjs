import { createPgClient, loadEnv } from "./load-env.mjs";

loadEnv();

async function tryUrl(label, url) {
  const client = createPgClient({ connectionString: url });

  try {
    await client.connect();
    const result = await client.query("SELECT 1 AS ok");
    console.log(`OK [${label}]`, result.rows[0]);
    await client.end();
    return true;
  } catch (error) {
    console.log(`FAIL [${label}]`, error.message);
    try {
      await client.end();
    } catch {
      // ignore
    }
    return false;
  }
}

function maskUrl(url) {
  return url.replace(/:[^:@/]+@/, ":****@");
}

if (process.env.DATABASE_POOLER_URL) {
  const ok = await tryUrl(
    "DATABASE_POOLER_URL",
    process.env.DATABASE_POOLER_URL.trim()
  );
  if (ok) {
    console.log("\nWorking connection:", maskUrl(process.env.DATABASE_POOLER_URL.trim()));
    process.exit(0);
  }
}

if (process.env.DATABASE_URL) {
  const ok = await tryUrl("DATABASE_URL", process.env.DATABASE_URL.trim());
  if (ok) {
    console.log("\nWorking connection:", maskUrl(process.env.DATABASE_URL.trim()));
    process.exit(0);
  }
}

console.error(
  "\nNo working connection found. Set DATABASE_POOLER_URL or DATABASE_URL in .env.local"
);
if (process.env.DATABASE_POOLER_URL) {
  console.error("Configured pooler:", maskUrl(process.env.DATABASE_POOLER_URL.trim()));
}
if (process.env.DATABASE_URL) {
  console.error("Configured direct:", maskUrl(process.env.DATABASE_URL.trim()));
}
process.exit(1);
