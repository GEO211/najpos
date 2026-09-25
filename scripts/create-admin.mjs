import { ensureAdminUser } from "./ensure-admin.mjs";

ensureAdminUser().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
