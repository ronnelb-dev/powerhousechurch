export const COMMUNICATION_AUDIENCE_TYPES = [
  "CELL_GROUP",
  "EVENT_REGISTRANTS",
  "FIRST_TIME_GUESTS",
  "KIDS_GUARDIANS",
] as const;

export type CommunicationAudienceType =
  (typeof COMMUNICATION_AUDIENCE_TYPES)[number];
