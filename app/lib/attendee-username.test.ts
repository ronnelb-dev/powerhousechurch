import { describe, expect, it } from "vitest";
import { attendeeUsernameBase } from "./attendee-username";

describe("attendeeUsernameBase", () => {
  it("uses the first initial and normalized surname", () => {
    expect(attendeeUsernameBase("Ronnel", "Barashari")).toBe("rbarashari");
  });

  it("removes accents and punctuation", () => {
    expect(attendeeUsernameBase("Élodie", "O’Connor-Smith")).toBe("eoconnorsmith");
  });

  it("keeps the generated username within the database limit", () => {
    expect(attendeeUsernameBase("A very long first name", "An extraordinarily long surname that exceeds forty characters")).toHaveLength(40);
  });
});
