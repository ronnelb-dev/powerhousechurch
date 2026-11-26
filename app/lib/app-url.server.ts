function normalizeOrigin(value: string) {
  return new URL(value).origin;
}

export function getTrustedAppOrigin(requestUrl?: string) {
  const configuredOrigin =
    process.env.APP_URL?.trim() || process.env.PUBLIC_APP_URL?.trim();

  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin);
  }

  if (process.env.NODE_ENV !== "production" && requestUrl) {
    return normalizeOrigin(requestUrl);
  }

  throw new Error(
    "APP_URL or PUBLIC_APP_URL must be configured for trusted email links.",
  );
}
