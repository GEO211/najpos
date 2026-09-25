import { readFileSync } from "fs";
import { resolve } from "path";
import { createPgClient } from "./load-env.mjs";

const processSaleSql = readFileSync(
  resolve(process.cwd(), "supabase", "schema.sql"),
  "utf8"
)
  .split("-- Process sale: deduct stock atomically")[1]
  .split("$$ LANGUAGE plpgsql SECURITY DEFINER;")[0];

const client = createPgClient();

await client.connect();
await client.query(`${processSaleSql}$$ LANGUAGE plpgsql SECURITY DEFINER;`);
console.log("Removed stock checks from process_sale");
await client.end();
