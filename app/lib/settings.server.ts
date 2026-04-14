import { db } from "./db.server";

type SettingsMap = Record<string, string>;

export async function getSettings(): Promise<SettingsMap> {
  const rows = await db.setting.findMany();
  return Object.fromEntries(rows.map((r: { key: any; value: any; }) => [r.key, r.value]));
}

