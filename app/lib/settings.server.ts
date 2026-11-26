// app/lib/settings.server.ts
// Server-side helper to read church settings from the database.
//
// The Settings table is a generic key/value store. Every public-facing
// string that an admin might want to change without a code deploy lives here:
// church name, service times, social links, YouTube channel ID, etc.
//
// Two exports:
//   getSettings()       → load all settings as a map (used by most loaders)
//   getSetting(key)     → load a single setting (used by targeted utilities
//                         like youtube.server.ts to avoid loading everything)

import { db } from "./db.server";

export type SettingsMap = Record<string, string>;

/**
 * Loads all setting rows and returns them as a flat key→value map.
 * Use this in route loaders that need multiple settings (home, contact, footer, etc.)
 */
export async function getSettings(): Promise<SettingsMap> {
  const rows = await db.setting.findMany();
  return Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
}

/**
 * Loads a single setting by key. Returns null if not found.
 * More efficient than getSettings() when you only need one value.
 *
 * Usage:
 *   const channelId = await getSetting("youtube.channelId");
 */
export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}