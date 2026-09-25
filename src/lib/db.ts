import pg from "pg";

function getConnectionString(): string {
  const poolerUrl = process.env.DATABASE_POOLER_URL?.trim();
  const directUrl = process.env.DATABASE_URL?.trim();

  if (poolerUrl) return poolerUrl;
  if (directUrl) return directUrl;

  throw new Error(
    "Database is not configured. Set DATABASE_POOLER_URL or DATABASE_URL in .env.local."
  );
}

export function createPgClient() {
  return new pg.Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
}

export async function withPgClient<T>(
  fn: (client: pg.Client) => Promise<T>
): Promise<T> {
  const client = createPgClient();

  try {
    await client.connect();
    return await fn(client);
  } catch (error) {
    if (error instanceof Error && /ETIMEDOUT|timeout expired/i.test(error.message)) {
      throw new Error(
        "Database connection timed out. Use the Supabase pooler URL in .env.local (DATABASE_POOLER_URL) instead of the direct db.*.supabase.co:5432 URL."
      );
    }

    throw error;
  } finally {
    await client.end();
  }
}
