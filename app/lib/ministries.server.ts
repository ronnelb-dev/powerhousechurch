import { db } from "~/lib/db.server";

const SAMPLE_MINISTRIES = [
  {
    name: "Worship Ministry",
    leader: "Ptr. Emmanuel Santos",
    description:
      "Leads the church in heartfelt worship through music, prayer, and a lifestyle of praise.",
    sortOrder: 1,
    isActive: true,
  },
  {
    name: "Kids Ministry",
    leader: "Sis. Maria Reyes",
    description:
      "Creates a safe, joyful, and Bible-centered space where children can grow in faith.",
    sortOrder: 2,
    isActive: true,
  },
  {
    name: "Youth Ministry",
    leader: "Bro. Joel Cruz",
    description:
      "Disciples the next generation through worship nights, small groups, and purposeful mentoring.",
    sortOrder: 3,
    isActive: true,
  },
  {
    name: "Ushering Ministry",
    leader: "Sis. Ana Torres",
    description:
      "Welcomes every guest and member with warmth, order, and practical hospitality during services.",
    sortOrder: 4,
    isActive: true,
  },
  {
    name: "Prayer Ministry",
    leader: "Ptr. Grace Villanueva",
    description:
      "Covers the church in intercession and ministers prayer to people in every season of life.",
    sortOrder: 5,
    isActive: true,
  },
  {
    name: "Media Ministry",
    leader: "Bro. Nathaniel Gomez",
    description:
      "Supports worship services and outreach through sound, projection, livestream, and creative media.",
    sortOrder: 6,
    isActive: true,
  },
];

export async function ensureSampleMinistries() {
  const count = await db.ministry.count();

  if (count > 0) return;

  await db.ministry.createMany({
    data: SAMPLE_MINISTRIES,
  });
}
