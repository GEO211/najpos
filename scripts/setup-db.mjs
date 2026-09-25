import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { createPgClient } from "./load-env.mjs";
import { ensureAdminUser } from "./ensure-admin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const client = createPgClient();

  await client.connect();
  console.log("Connected to database");

  const { rows } = await client.query(
    "SELECT to_regclass('public.profiles') AS exists"
  );

  if (!rows[0].exists) {
    const schemaPath = path.join(__dirname, "..", "supabase", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await client.query(schema);
    console.log("Schema applied successfully");
  } else {
    console.log("Schema already exists, skipping");
  }

  const seedScript = path.join(__dirname, "seed-haliya-menu.mjs");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [seedScript], {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Menu seed failed"))
    );
  });

  await ensureAdminUser({ client });
  console.log(
    "Default owner account ready (see ADMIN_EMAIL in .env.local or scripts/ensure-admin.mjs)"
  );

  await client.end();
}

run().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
