import { withPgClient } from "@/lib/db";

const DEFAULT_BEEPER_ENABLED = false;

export async function getBeeperEnabled(): Promise<boolean> {
  try {
    return await withPgClient(async (client) => {
      const { rows } = await client.query<{ beeper_enabled: boolean }>(
        `INSERT INTO store_settings (id, beeper_enabled)
         VALUES (1, $1)
         ON CONFLICT (id) DO UPDATE SET id = store_settings.id
         RETURNING beeper_enabled`,
        [DEFAULT_BEEPER_ENABLED]
      );
      return Boolean(rows[0]?.beeper_enabled);
    });
  } catch {
    return DEFAULT_BEEPER_ENABLED;
  }
}

export async function setBeeperEnabled(enabled: boolean): Promise<void> {
  await withPgClient(async (client) => {
    await client.query(
      `INSERT INTO store_settings (id, beeper_enabled, updated_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE
       SET beeper_enabled = EXCLUDED.beeper_enabled,
           updated_at = NOW()`,
      [enabled]
    );
  });
}
