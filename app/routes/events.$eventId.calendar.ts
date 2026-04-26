import type { LoaderFunctionArgs } from "react-router";
import {
  createEventCalendarIcs,
  getEventCalendarFilename,
} from "~/lib/calendar";
import { db } from "~/lib/db.server";

const prisma = db as any;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const eventId = params.eventId;
  if (!eventId) {
    throw new Response("Not found", { status: 404 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      startDate: true,
      endDate: true,
      isPublished: true,
    },
  });

  if (!event || !event.isPublished) {
    throw new Response("Not found", { status: 404 });
  }

  const origin =
    process.env.APP_URL || process.env.PUBLIC_APP_URL || new URL(request.url).origin;
  const body = createEventCalendarIcs({
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startDate: event.startDate,
    endDate: event.endDate,
    url: `${origin}/events#${event.id}`,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${getEventCalendarFilename({
        title: event.title,
        startDate: event.startDate,
      })}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
