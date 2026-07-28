export type SocialKey = "social.facebook" | "social.instagram" | "social.youtube" | "social.tiktok";

export const SOCIAL_DEFAULTS: Record<SocialKey, string> = {
  "social.facebook": "https://www.facebook.com/PowerhouseChurchInternational",
  "social.instagram": "https://www.instagram.com/_powerhouseintl/",
  "social.youtube": "https://www.youtube.com/@pcf_intl",
  "social.tiktok": "https://www.tiktok.com/@pcf_intl",
};

export function getSocialLink(settings: Record<string, string>, key: SocialKey) {
  return settings[key] ?? SOCIAL_DEFAULTS[key];
}

