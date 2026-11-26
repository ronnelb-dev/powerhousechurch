import { db } from "./db.server";

export type PrayerRequestOwner = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type PrayerRequestInboxItem = {
  key: string;
  sourceId: string;
  title: string;
  email: string | null;
  ownerId: string | null;
  owner: PrayerRequestOwner | null;
  lastContactedAt: string | null;
  notes: string | null;
  nextAction: string | null;
  reminderAt: string | null;
  openedAt: string;
  isReminderDue: boolean;
  prayerStatus: string;
  prayerRequest: string;
  isPrivate: boolean;
  answeredAt: string | null;
};

function toIsoOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function matchesQuery(item: PrayerRequestInboxItem, query: string) {
  if (!query) return true;

  return [
    item.title,
    item.email,
    item.notes,
    item.nextAction,
    item.prayerRequest,
    item.prayerStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query.toLowerCase());
}

export async function getPrayerRequestOwners() {
  return db.user.findMany({
    where: {
      isActive: true,
      role: { in: ["ADMIN", "CELL_LEADER"] },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, role: true },
  });
}

export async function getPrayerRequestInbox({
  bucket,
  ownerId,
  query,
  dueOnly,
}: {
  bucket: "open" | "archive";
  ownerId: string;
  query: string;
  dueOnly: boolean;
}) {
  const now = new Date();
  const [owners, prayers] = await Promise.all([
    getPrayerRequestOwners(),
    db.prayerRequest.findMany({
      where: { isAnswered: bucket === "archive" },
      orderBy:
        bucket === "archive"
          ? [{ answeredAt: "desc" }, { submittedAt: "desc" }]
          : [{ submittedAt: "desc" }],
      take: 100,
      include: {
        followUpOwner: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        careCase: {
          include: {
            assignedOwner: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
      },
    }),
  ]);

  const items = prayers
    .map((prayer): PrayerRequestInboxItem => {
      const reminderAt = toIsoOrNull(prayer.careCase?.reminderAt);
      const owner =
        prayer.careCase?.assignedOwner ?? prayer.followUpOwner ?? null;
      const resolvedOwnerId =
        prayer.careCase?.assignedOwnerId ?? prayer.followUpOwnerId ?? null;

      return {
        key: `prayer:${prayer.id}`,
        sourceId: prayer.id,
        title: prayer.name,
        email: prayer.email,
        ownerId: resolvedOwnerId,
        owner,
        lastContactedAt: toIsoOrNull(prayer.careCase?.lastContactedAt),
        notes: prayer.careCase?.notes ?? null,
        nextAction: prayer.careCase?.nextAction ?? null,
        reminderAt,
        openedAt: prayer.submittedAt.toISOString(),
        isReminderDue:
          bucket === "open" && reminderAt ? new Date(reminderAt) <= now : false,
        prayerStatus: prayer.status,
        prayerRequest: prayer.request,
        isPrivate: prayer.isPrivate,
        answeredAt: toIsoOrNull(prayer.answeredAt),
      };
    })
    .filter((item) => {
      if (ownerId === "unassigned") return item.ownerId === null;
      return !ownerId || item.ownerId === ownerId;
    })
    .filter((item) => matchesQuery(item, query))
    .filter((item) => (dueOnly ? item.isReminderDue : true))
    .sort((left, right) => {
      if (left.isReminderDue !== right.isReminderDue) {
        return left.isReminderDue ? -1 : 1;
      }

      const leftReminder = left.reminderAt
        ? new Date(left.reminderAt).getTime()
        : Number.MAX_SAFE_INTEGER;
      const rightReminder = right.reminderAt
        ? new Date(right.reminderAt).getTime()
        : Number.MAX_SAFE_INTEGER;
      if (leftReminder !== rightReminder) return leftReminder - rightReminder;

      return (
        new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime()
      );
    });

  return {
    owners,
    items,
    stats: {
      total: items.length,
      due: items.filter((item) => item.isReminderDue).length,
      unassigned: items.filter((item) => !item.ownerId).length,
    },
  };
}
