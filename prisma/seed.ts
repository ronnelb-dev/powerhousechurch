import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Settings ──────────────────────────────────────────────
  const settings = [
    { key: "church.name",           value: "Powerhouse Church Christian Fellowship Intl." },
    { key: "church.tagline",        value: "Where Faith Meets Community" },
    { key: "church.address",        value: "123 Masbate Street, Masbate City, Philippines" },
    { key: "church.email",          value: "info@powerhousechurch.ph" },
    { key: "church.phone",          value: "+63 917 000 0000" },
    { key: "service.sunday1",       value: "7:00 AM" },
    { key: "service.sunday2",       value: "9:00 AM" },
    {
      key: "service.cellGroupDays",
      value: [
        "Wednesday 6:30 PM at PCF Church",
        "Wednesday 7:00 PM at Bamboo Orchard, Banay-Banay",
        "Thursday 7:00 PM at Garden Villas Sta. Rosa",
      ].join("\n"),
    },
    { key: "social.facebook",       value: "https://facebook.com/powerhousechurch" },
    { key: "social.youtube",        value: "https://youtube.com/@powerhousechurch" },
    { key: "social.instagram",      value: "https://instagram.com/powerhousechurch" },
  ];

  for (const setting of settings) {
    await db.setting.upsert({
      where:  { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log("✅ Settings seeded");

  // ── Cell group ─────────────────────────────────────────────
  const cellGroup = await db.cellGroup.upsert({
    where:  { id: "cg-graceland" },
    update: {},
    create: {
      id:          "cg-graceland",
      name:        "Graceland",
      // Retained only because the deployed table still requires this legacy column.
      leaderId:    "legacy-public-leader",
      meetingDay:  "Friday",
      meetingTime: "6:00 PM",
      barangay:    "Poblacion",
    },
  });

  console.log("✅ Cell group seeded:", cellGroup.name);

  // ── Sermons ────────────────────────────────────────────────
  const sermons = [
    {
      title:       "When Fire Falls: A Faith That Cannot Be Shaken",
      speaker:     "Ptr. Emmanuel Santos",
      series:      "Walking in the Spirit",
      videoUrl:    "https://www.youtube.com/watch?v=example1",
      date:        new Date("2025-04-06"),
      tags:        "Holy Spirit,Faith,Revival",
      isPublished: true,
    },
    {
      title:       "Rooted in the Rock",
      speaker:     "Ptr. Grace Villanueva",
      series:      "Unshakeable",
      videoUrl:    "https://www.youtube.com/watch?v=example2",
      date:        new Date("2025-03-30"),
      tags:        "Faith,Foundation,Trust",
      isPublished: true,
    },
    {
      title:       "Heirs of the Kingdom",
      speaker:     "Ptr. Emmanuel Santos",
      series:      "The Promise",
      date:        new Date("2025-03-23"),
      tags:        "Promise,Identity,Kingdom",
      isPublished: true,
    },
  ];

  for (const sermon of sermons) {
    await db.sermon.upsert({
      where:  { id: `sermon-${sermon.date.toISOString().slice(0, 10)}` },
      update: {},
      create: { id: `sermon-${sermon.date.toISOString().slice(0, 10)}`, ...sermon },
    });
  }
  console.log("✅ Sermons seeded");

  // ── Events ─────────────────────────────────────────────────
  const events = [
    {
      id:          "event-easter-2025",
      title:       "Easter Sunday Celebration",
      description: "All services combined into one glorious celebration of the Resurrection.",
      location:    "Main Sanctuary",
      startDate:   new Date("2025-04-20T07:00:00"),
      isPublished: true,
    },
    {
      id:          "event-cell-summit-2025",
      title:       "Cell Leaders Summit",
      description: "Quarterly equipping session for all cell leaders.",
      location:    "Fellowship Hall",
      startDate:   new Date("2025-04-26T09:00:00"),
      endDate:     new Date("2025-04-26T12:00:00"),
      isPublished: true,
    },
    {
      id:          "event-missions-2025",
      title:       "Missions Night 2025",
      description: "An evening celebrating and commissioning our missions partners.",
      location:    "Main Sanctuary",
      startDate:   new Date("2025-05-10T19:00:00"),
      isPublished: true,
    },
  ];

  for (const event of events) {
    await db.event.upsert({
      where:  { id: event.id },
      update: {},
      create: event,
    });
  }
  console.log("✅ Events seeded");

  // ── Event registrations ───────────────────────────────────
  await db.eventRegistration.upsert({
    where: {
      eventId_email: {
        eventId: "event-missions-2025",
        email: "lena@example.com",
      },
    },
    update: {},
    create: {
      eventId: "event-missions-2025",
      name: "Lena Gomez",
      email: "lena@example.com",
      phone: "+63 917 111 2222",
      notes: "Interested in joining the intercessory prayer team.",
      status: "CONFIRMED",
    },
  });

  await db.eventRegistration.upsert({
    where: {
      eventId_email: {
        eventId: "event-missions-2025",
        email: "mark@example.com",
      },
    },
    update: {},
    create: {
      eventId: "event-missions-2025",
      name: "Mark Flores",
      email: "mark@example.com",
      phone: "+63 917 333 4444",
      notes: "Needs one extra seat if openings become available.",
      status: "WAITLISTED",
    },
  });
  console.log("✅ Event registrations seeded");

  // ── Visit plans ───────────────────────────────────────────
  await db.visitPlan.upsert({
    where: { id: "visit-plan-seed-001" },
    update: {},
    create: {
      id: "visit-plan-seed-001",
      name: "Katrina Ramos",
      email: "katrina@example.com",
      phone: "+63 917 555 0101",
      city: "Masbate City",
      preferredService: "Sunday 9:00 AM",
      visitDate: new Date("2026-04-27"),
      adultCount: 2,
      isFirstTimeGuest: true,
      bringingKids: true,
      kidsCount: 2,
      kidsDetails: "Ages 6 and 9. One peanut allergy.",
      wantsUsherFollowUp: true,
      wantsPastorFollowUp: false,
      notes: "They are new in town and want directions before Sunday.",
    },
  });

  await db.visitPlan.upsert({
    where: { id: "visit-plan-seed-002" },
    update: {},
    create: {
      id: "visit-plan-seed-002",
      name: "Robert Mendoza",
      email: "robert@example.com",
      phone: "+63 917 555 0202",
      city: "Mobo",
      preferredService: "Sunday 7:00 AM",
      visitDate: new Date("2026-04-20"),
      adultCount: 1,
      isFirstTimeGuest: true,
      bringingKids: false,
      wantsUsherFollowUp: false,
      wantsPastorFollowUp: true,
      notes: "Asked for prayer and a conversation after service.",
    },
  });
  console.log("✅ Visit plans seeded");

  // ── Ministries ─────────────────────────────────────────────
  const ministries = [
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

  for (const ministry of ministries) {
    const existing = await db.ministry.findFirst({
      where: { name: ministry.name },
      select: { id: true },
    });

    if (!existing) {
      await db.ministry.create({ data: ministry });
    }
  }
  console.log("✅ Ministries seeded");

  console.log("🌿 Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
