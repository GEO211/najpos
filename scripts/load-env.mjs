import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

export function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // use existing process.env
  }
}

export function requireEnv(name) {
  loadEnv();
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is not set. Add it to .env.local`);
    process.exit(1);
  }
  return value;
}

export function getDbUrl() {
  loadEnv();
  const url =
    process.env.DATABASE_POOLER_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error(
      "DATABASE_POOLER_URL or DATABASE_URL is not set in .env.local"
    );
    process.exit(1);
  }
  return url;
}

export function createPgClient(options = {}) {
  return new pg.Client({
    connectionString: getDbUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    ...options,
  });
}

export function getSupabaseUrl() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey() {
  loadEnv();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is not set in .env.local"
    );
    process.exit(1);
  }
  return key;
}

export function getEmailArg(fallbackEnv = "ADMIN_EMAIL") {
  loadEnv();
  const email = process.argv[2]?.trim() || process.env[fallbackEnv]?.trim();
  if (!email) {
    console.error(
      `Usage: node ${process.argv[1]} owner@email.com\nOr set ${fallbackEnv} in .env.local`
    );
    process.exit(1);
  }
  return email;
}
