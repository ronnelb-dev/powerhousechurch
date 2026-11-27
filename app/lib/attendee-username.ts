const USERNAME_MAX_LENGTH = 40;

function normalizeNamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function attendeeUsernameBase(firstName: string, lastName: string) {
  const initial = normalizeNamePart(firstName).charAt(0) || "a";
  const surname = normalizeNamePart(lastName);
  return `${initial}${surname}`.slice(0, USERNAME_MAX_LENGTH) || "attendee";
}
