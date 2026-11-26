import { db } from "~/lib/db.server";
import {
  COMMUNICATION_AUDIENCE_TYPES,
  type CommunicationAudienceType,
} from "~/lib/communications";

export { COMMUNICATION_AUDIENCE_TYPES };
export type { CommunicationAudienceType };

export type CommunicationRecipient = {
  email: string;
  name: string;
  sourceLabel: string;
};

export async function getCommunicationAudienceOptions() {
  const [cellGroups, events, firstTimeGuestCount, kidsGuardianCount] =
    await Promise.all([
      db.cellGroup.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, _count: { select: { members: true } } },
      }),
      db.event.findMany({
        orderBy: { startDate: "desc" },
        select: { id: true, title: true, startDate: true, _count: { select: { registrations: true } } },
      }),
      db.visitPlan.count({ where: { isFirstTimeGuest: true } }),
      db.childGuardian.count({
        where: { email: { not: null }, child: { isActive: true } },
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
  const { audienceType } = args;
  return {
    audienceLabel: audienceType,
    recipients: [] as CommunicationRecipient[],
  };
}
