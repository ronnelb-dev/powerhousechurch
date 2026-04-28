const DEFAULT_MIDWEEK_SERVICES = [
  "Wednesday 6:30 PM at PCF Church",
  "Wednesday 7:00 PM at Bamboo Orchard, Banay-Banay",
  "Thursday 7:00 PM at Garden Villas Sta. Rosa",
] as const;

const LEGACY_CELL_GROUP_VALUES = new Set([
  "friday-saturday",
  "friday saturday",
  "fri-sat",
  "fri sat",
]);

function normalizeServiceValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getMidweekServices(settings: Record<string, string>) {
  const rawValue = settings["service.cellGroupDays"]?.trim();

  if (!rawValue) {
    return [...DEFAULT_MIDWEEK_SERVICES];
  }

  if (LEGACY_CELL_GROUP_VALUES.has(normalizeServiceValue(rawValue))) {
    return [...DEFAULT_MIDWEEK_SERVICES];
  }

  return rawValue
    .split(/\r?\n|\s*\|\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getMidweekServiceValue(settings: Record<string, string>) {
  return getMidweekServices(settings).join("\n");
}
