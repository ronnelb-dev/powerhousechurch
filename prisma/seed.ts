import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

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

  // ── Admin user ─────────────────────────────────────────────
  const adminHash = await hash("Admin@2025!", {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  const admin = await db.user.upsert({
    where:  { email: "admin@powerhousechurch.ph" },
    update: {},
    create: {
      firstName:    "Emmanuel",
      lastName:     "Santos",
      email:        "admin@powerhousechurch.ph",
      passwordHash: adminHash,
      age:          45,
      gender:       "MALE",
      birthday:     new Date("1980-03-15"),
      role:         "ADMIN",
    },
  });
  console.log("✅ Admin created:", admin.email);

  // ── Cell leader ────────────────────────────────────────────
  const leaderHash = await hash("Leader@2025!", {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  const leader = await db.user.upsert({
    where:  { email: "grace@powerhousechurch.ph" },
    update: {},
    create: {
      firstName:    "Grace",
      lastName:     "Villanueva",
      email:        "grace@powerhousechurch.ph",
      passwordHash: leaderHash,
      age:          32,
      gender:       "FEMALE",
      birthday:     new Date("1993-07-22"),
      role:         "CELL_LEADER",
    },
  });

  // ── Cell group ─────────────────────────────────────────────
  const cellGroup = await db.cellGroup.upsert({
    where:  { id: "cg-graceland" },
    update: {},
    create: {
      id:          "cg-graceland",
      name:        "Graceland",
      leaderId:    leader.id,
      meetingDay:  "Friday",
      meetingTime: "6:00 PM",
      barangay:    "Poblacion",
    },
  });

  // Assign leader to her own cell group
  await db.user.update({
    where: { id: leader.id },
    data:  { cellGroupId: cellGroup.id },
  });
  console.log("✅ Cell group seeded:", cellGroup.name);

  // ── Members ────────────────────────────────────────────────
  const memberHash = await hash("Member@2025!", {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  const memberData = [
    { email: "maria@example.com", firstName: "Maria", lastName: "Reyes",  age: 28, gender: "FEMALE", birthday: new Date("1997-01-10") },
    { email: "joel@example.com",  firstName: "Joel",  lastName: "Cruz",   age: 24, gender: "MALE",   birthday: new Date("2001-05-18") },
    { email: "ana@example.com",   firstName: "Ana",   lastName: "Torres", age: 35, gender: "FEMALE", birthday: new Date("1990-11-03") },
  ];

  const members = [];
  for (const m of memberData) {
    const member = await db.user.upsert({
      where:  { email: m.email },
      update: {},
      create: {
        ...m,
        passwordHash: memberHash,
        role:         "MEMBER",
        cellGroupId:  cellGroup.id,
      },
    });
    members.push(member);
  }
  console.log("✅ Members seeded:", members.length);

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
      status: "READY_FOR_SUNDAY",
      followUpOwnerId: leader.id,
      lastContactedAt: new Date(),
      nextFollowUpAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      outcomeNotes: "Texted directions and confirmed kids check-in support.",
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
      status: "CONTACT_ATTEMPTED",
      followUpOwnerId: admin.id,
      nextFollowUpAt: new Date(),
      outcomeNotes: "Called once and sent an email. Waiting for reply.",
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

  // ── Attendance (Ana — the "Needs Care" member) ─────────────
  const sundays = [
    new Date("2025-03-02"), new Date("2025-03-09"),
    new Date("2025-03-16"), new Date("2025-03-23"),
    new Date("2025-03-30"), new Date("2025-04-06"),
  ];
  const anaStatuses: string[] = [
    "PRESENT", "PRESENT", "PRESENT", "ABSENT", "ABSENT", "PRESENT",
  ];

  for (const [index, sunday] of sundays.entries()) {
    const member = members[2];
    const status = anaStatuses[index];
    if (!member || !status) continue;

    await db.attendance.upsert({
      where: {
        userId_type_date: {
          userId: member.id,
          type:   "SUNDAY_SERVICE",
          date:   sunday,
        },
      },
      update: {},
      create: {
        userId:      member.id,
        cellGroupId: cellGroup.id,
        type:        "SUNDAY_SERVICE",
        status,
        date:        sunday,
        markedById:  leader.id,
      },
    });
  }
  console.log("✅ Attendance records seeded");

  // ── Devotion post ──────────────────────────────────────────
  await db.post.upsert({
    where:  { id: "post-seed-001" },
    update: {},
    create: {
      id:         "post-seed-001",
      authorId:   admin.id,
      bibleVerse: "John 15:5",
      bibleText:  "I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing.",
      content:    "This week I was reminded that fruitfulness is not a result of my effort, but of my abiding. When I rest in Him — in prayer, in the Word, in community — things flourish.",
      scope:      "PUBLIC",
      isApproved: true,
    },
  });
  console.log("✅ Sample devotion post seeded");

  console.log("🌿 Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
