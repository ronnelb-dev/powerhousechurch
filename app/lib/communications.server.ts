import { db } from "~/lib/db.server";
import { sendTargetedEmail } from "~/lib/email.server";

export const COMMUNICATION_AUDIENCE_TYPES = [
  "CELL_GROUP",
  "EVENT_REGISTRANTS",
  "FIRST_TIME_GUESTS",
  "KIDS_GUARDIANS",
] as const;

export type CommunicationAudienceType =
  (typeof COMMUNICATION_AUDIENCE_TYPES)[number];

export type CommunicationRecipient = {
  email: string;
  name: string;
  sourceLabel: string;
};

function dedupeRecipients(recipients: CommunicationRecipient[]) {
  const seen = new Map<string, CommunicationRecipient>();

  for (const recipient of recipients) {
    const email = recipient.email.trim().toLowerCase();
    if (!email) continue;

    if (!seen.has(email)) {
      seen.set(email, {
        email,
        name: recipient.name.trim() || "Friend",
        sourceLabel: recipient.sourceLabel,
      });
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCommunicationAudienceOptions() {
  const [cellGroups, events, firstTimeGuestCount, kidsGuardianCount] =
    await Promise.all([
      db.cellGroup.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          _count: { select: { members: true } },
        },
      }),
      db.event.findMany({
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          title: true,
          startDate: true,
          _count: { select: { registrations: true } },
        },
      }),
      db.visitPlan.count({
        where: {
          isFirstTimeGuest: true,
        },
      }),
      db.childGuardian.count({
        where: {
          email: { not: null },
          child: { isActive: true },
        },
      }),
    ]);

  return {
    cellGroups: cellGroups.map((group) => ({
      id: group.id,
      name: group.name,
      memberCount: group._count.members,
    })),
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      startDate: event.startDate.toISOString(),
      registrationCount: event._count.registrations,
    })),
    audienceStats: {
      firstTimeGuests: firstTimeGuestCount,
      kidsGuardians: kidsGuardianCount,
    },
  };
}

export async function getCommunicationAudienceRecipients(args: {
  audienceType: CommunicationAudienceType;
  audienceId?: string | null;
}) {
  const { audienceType, audienceId } = args;

  switch (audienceType) {
    case "CELL_GROUP": {
      if (!audienceId) {
        return {
          audienceLabel: "Cell group",
          recipients: [],
        };
      }

      const group = await db.cellGroup.findUnique({
        where: { id: audienceId },
        select: {
          name: true,
          members: {
            where: {
              isActive: true,
              email: { not: null },
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return {
        audienceLabel: group ? `Cell group: ${group.name}` : "Cell group",
        recipients: dedupeRecipients(
          (group?.members ?? []).map((member) => ({
            email: member.email ?? "",
            name: `${member.firstName} ${member.lastName}`.trim(),
            sourceLabel: group?.name ?? "Cell group member",
          })),
        ),
      };
    }
    case "EVENT_REGISTRANTS": {
      if (!audienceId) {
        return {
          audienceLabel: "Event registrants",
          recipients: [],
        };
      }

      const event = await db.event.findUnique({
        where: { id: audienceId },
        select: {
          title: true,
          registrations: {
            orderBy: [{ status: "asc" }, { createdAt: "asc" }],
            select: {
              name: true,
              email: true,
              status: true,
            },
          },
        },
      });

      return {
        audienceLabel: event ? `Event registrants: ${event.title}` : "Event registrants",
        recipients: dedupeRecipients(
          (event?.registrations ?? []).map((registration) => ({
            email: registration.email,
            name: registration.name,
            sourceLabel: registration.status,
          })),
        ),
      };
    }
    case "FIRST_TIME_GUESTS": {
      const guests = await db.visitPlan.findMany({
        where: { isFirstTimeGuest: true },
        orderBy: { submittedAt: "desc" },
        select: {
          name: true,
          email: true,
          preferredService: true,
        },
      });

      return {
        audienceLabel: "First-time guests",
        recipients: dedupeRecipients(
          guests.map((guest) => ({
            email: guest.email,
            name: guest.name,
            sourceLabel: guest.preferredService,
          })),
        ),
      };
    }
    case "KIDS_GUARDIANS": {
      const guardians = await db.childGuardian.findMany({
        where: {
          email: { not: null },
          child: { isActive: true },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          firstName: true,
          lastName: true,
          email: true,
          relationship: true,
        },
      });

      return {
        audienceLabel: "Kids ministry guardians",
        recipients: dedupeRecipients(
          guardians.map((guardian) => ({
            email: guardian.email ?? "",
            name: `${guardian.firstName} ${guardian.lastName}`.trim(),
            sourceLabel: guardian.relationship,
          })),
        ),
      };
    }
  }
}

export async function sendCommunicationToAudience(args: {
  subject: string;
  body: string;
  audienceLabel: string;
  recipients: CommunicationRecipient[];
}) {
  const { subject, body, audienceLabel, recipients } = args;
  const results: Array<{ ok: boolean; email: string }> = [];
  const batchSize = 10;

  for (let index = 0; index < recipients.length; index += batchSize) {
    const batch = recipients.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map((recipient) =>
        sendTargetedEmail({
          to: recipient.email,
          recipientName: recipient.name,
          subject,
          body,
          audienceLabel,
        })
          .then(() => ({ ok: true, email: recipient.email }))
          .catch(() => ({ ok: false, email: recipient.email })),
      ),
    );

    results.push(...batchResults);
  }

  const sentCount = results.filter((result) => result.ok).length;
  const failedCount = results.length - sentCount;

  return {
    sentCount,
    failedCount,
  };
}
