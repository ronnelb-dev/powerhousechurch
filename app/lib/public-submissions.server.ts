import { data } from "react-router";
import { z } from "zod";
import {
  ContactFormSchema,
  PrayerRequestSchema,
  VisitPlanSchema,
} from "~/lib/schemas.server";
import {
  DEFAULT_CONTACT_FORM_VALUES,
  DEFAULT_VISIT_FORM_VALUES,
  getServiceOptions,
  type ContactFormValues,
  type VisitFormValues,
} from "~/lib/public-submissions";

const rsvpSchema = z.object({
  intent: z.literal("rsvp"),
  eventId: z.string().min(1),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Enter a valid email address").max(200),
  phone: z.string().min(7, "Phone number is required").max(30),
  notes: z
    .string()
    .max(500, "Notes must be 500 characters or fewer")
    .optional()
    .or(z.literal("")),
  honeypot: z.string().max(0, "Bot detected").default(""),
});

export type RSVPActionData =
  | {
      success: true;
      eventId: string;
      status: "CONFIRMED" | "WAITLISTED";
      message: string;
    }
  | {
      success: false;
      eventId?: string;
      formError?: string;
      errors: Record<string, string[]>;
    };

type RSVPDeps = {
  db: {
    $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
  };
  sendEventRegistrationConfirmation(args: {
    to: string;
    name: string;
    eventTitle: string;
    eventLocation: string;
    eventStartDate: Date;
    eventEndDate?: Date | null;
    status: "CONFIRMED" | "WAITLISTED";
    calendarUrl?: string;
    googleCalendarUrl?: string;
    eventUrl?: string;
  }): Promise<unknown>;
  buildEventCalendarUrl(origin: string, eventId: string): string;
  buildGoogleCalendarUrl(args: {
    id: string;
    title: string;
    description: string;
    location: string;
    startDate: Date;
    endDate: Date | null;
    url?: string;
  }): string;
};

type ContactDeps = {
  resendApiKey?: string;
  sendContactEmail(args: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<unknown>;
};

export { DEFAULT_CONTACT_FORM_VALUES, DEFAULT_VISIT_FORM_VALUES, getServiceOptions };
export type { ContactFormValues, VisitFormValues };

export type ContactActionData =
  | { success: true }
  | {
      success: false;
      values: ContactFormValues;
      errors?: Record<string, string[]>;
      globalError?: string;
    };

type PrayerDeps = {
  userId?: string | null;
  db: {
    prayerRequest: {
      create(args: unknown): Promise<unknown>;
    };
  };
  notifyAdminOfPrayerRequest(
    name: string,
    requestText: string,
    isPrivate: boolean,
  ): Promise<unknown>;
  sendPrayerRequestConfirmation(to: string, name: string): Promise<unknown>;
};

type VisitPlanDeps = {
  settings: Record<string, string>;
  db: {
    visitPlan: {
      create(args: unknown): Promise<unknown>;
    };
  };
  resendApiKey?: string;
  notifyAdminOfVisitPlan(args: {
    name: string;
    email: string;
    phone?: string | null;
    city?: string | null;
    preferredService: string;
    visitDate?: string | null;
    adultCount: number;
    isFirstTimeGuest: boolean;
    bringingKids: boolean;
    kidsCount?: number | null;
    kidsDetails?: string | null;
    wantsUsherFollowUp: boolean;
    wantsPastorFollowUp: boolean;
    notes?: string | null;
  }): Promise<unknown>;
  sendVisitPlanConfirmation(args: {
    to: string;
    firstName: string;
    preferredService: string;
    visitDate?: string;
    bringingKids: boolean;
    wantsUsherFollowUp: boolean;
    wantsPastorFollowUp: boolean;
  }): Promise<unknown>;
};

export type VisitPlanActionData =
  | {
      success: true;
      name: string;
      preferredService: string;
      visitDate: string | null;
      bringingKids: boolean;
      wantsUsherFollowUp: boolean;
      wantsPastorFollowUp: boolean;
    }
  | {
      success: false;
      values: VisitFormValues;
      errors?: Record<string, string[]>;
      globalError?: string;
    };

export async function handleRsvpSubmission(
  raw: Record<string, string>,
  requestUrl: string,
  deps: RSVPDeps,
) {
  const parsed = rsvpSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      eventId: raw.eventId || undefined,
      errors: parsed.error.flatten().fieldErrors,
    } satisfies RSVPActionData;
  }

  try {
    const result = await deps.db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: parsed.data.eventId },
        include: {
          registrations: {
            select: { status: true },
          },
        },
      });

      if (!event || !event.isPublished) {
        return {
          kind: "error" as const,
          formError: "This event is no longer available for registration.",
        };
      }

      if (!event.requiresRegistration) {
        return {
          kind: "error" as const,
          formError: "This event does not require RSVP.",
        };
      }

      const now = new Date();
      if (event.startDate < now) {
        return {
          kind: "error" as const,
          formError: "This event has already started.",
        };
      }

      if (event.registrationDeadline && event.registrationDeadline < now) {
        return {
          kind: "error" as const,
          formError: "Registration for this event has already closed.",
        };
      }

      const existing = await tx.eventRegistration.findUnique({
        where: {
          eventId_email: {
            eventId: event.id,
            email: parsed.data.email,
          },
        },
      });

      if (existing) {
        return {
          kind: "error" as const,
          formError: "This email address is already registered for the event.",
        };
      }

      const confirmedCount = event.registrations.filter(
        (entry: { status: string }) => entry.status === "CONFIRMED",
      ).length;
      const status: "CONFIRMED" | "WAITLISTED" =
        typeof event.capacity === "number" && confirmedCount >= event.capacity
          ? "WAITLISTED"
          : "CONFIRMED";

      await tx.eventRegistration.create({
        data: {
          eventId: event.id,
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          notes: parsed.data.notes || null,
          status,
        },
      });

      return {
        kind: "success" as const,
        status,
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          startDate: event.startDate,
          endDate: event.endDate,
        },
      };
    });

    if (result.kind === "error") {
      return {
        success: false,
        eventId: parsed.data.eventId,
        formError: result.formError,
        errors: {},
      } satisfies RSVPActionData;
    }

    const currentUrl = new URL(requestUrl);
    const origin =
      process.env.APP_URL || process.env.PUBLIC_APP_URL || currentUrl.origin;
    const eventUrl = `${origin}/events#${result.event.id}`;
    const calendarUrl = deps.buildEventCalendarUrl(origin, result.event.id);
    const googleCalendarUrl = deps.buildGoogleCalendarUrl({
      id: result.event.id,
      title: result.event.title,
      description: result.event.description,
      location: result.event.location,
      startDate: result.event.startDate,
      endDate: result.event.endDate,
      url: eventUrl,
    });

    await Promise.allSettled([
      deps.sendEventRegistrationConfirmation({
        to: parsed.data.email,
        name: parsed.data.name,
        eventTitle: result.event.title,
        eventLocation: result.event.location,
        eventStartDate: result.event.startDate,
        eventEndDate: result.event.endDate,
        status: result.status,
        calendarUrl,
        googleCalendarUrl,
        eventUrl,
      }),
    ]);

    return {
      success: true,
      eventId: parsed.data.eventId,
      status: result.status,
      message:
        result.status === "CONFIRMED"
          ? "Your RSVP is confirmed. A confirmation email is on its way."
          : "The event is full, so you have been added to the waitlist. A confirmation email is on its way.",
    } satisfies RSVPActionData;
  } catch {
    return {
      success: false,
      eventId: parsed.data.eventId,
      formError: "We could not complete your RSVP. Please try again.",
      errors: {},
    } satisfies RSVPActionData;
  }
}

export async function handleContactSubmission(
  raw: Record<string, string>,
  deps: ContactDeps,
) {
  const result = ContactFormSchema.safeParse(raw);
  if (!result.success) {
    return data(
      {
        success: false,
        values: {
          name: raw.name ?? "",
          email: raw.email ?? "",
          subject: raw.subject ?? "",
          message: raw.message ?? "",
          honeypot: raw.honeypot ?? "",
        },
        errors: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  if (!deps.resendApiKey) {
    return data(
      {
        success: false,
        values: {
          name: result.data.name,
          email: result.data.email,
          subject: result.data.subject,
          message: result.data.message,
          honeypot: result.data.honeypot,
        },
        globalError:
          "Contact email is not configured yet. Please call or email the church directly for now.",
      },
      { status: 503 },
    );
  }

  try {
    await deps.sendContactEmail(result.data);
  } catch (error) {
    console.error("[contact] Failed to send contact email:", error);
    return data(
      {
        success: false,
        values: {
          name: result.data.name,
          email: result.data.email,
          subject: result.data.subject,
          message: result.data.message,
          honeypot: result.data.honeypot,
        },
        globalError:
          "We couldn't send your message right now. Please try again later or contact the church directly.",
      },
      { status: 502 },
    );
  }

  return { success: true } as const;
}

export async function handlePrayerRequestSubmission(
  raw: Record<string, string | boolean>,
  deps: PrayerDeps,
) {
  const result = PrayerRequestSchema.safeParse(raw);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    } as const;
  }

  const { name, email, request, isPrivate } = result.data;

  await deps.db.prayerRequest.create({
    data: {
      memberId: deps.userId ?? null,
      name,
      email: email || null,
      request,
      isPrivate,
    },
  });

  const jobs: Promise<unknown>[] = [
    deps.notifyAdminOfPrayerRequest(name, request, isPrivate),
  ];
  if (email) {
    jobs.push(deps.sendPrayerRequestConfirmation(email, name));
  }
  await Promise.allSettled(jobs);

  return { success: true } as const;
}

export async function handleVisitPlanSubmission(
  rawValues: VisitFormValues,
  deps: VisitPlanDeps,
) {
  const serviceValues = getServiceOptions(deps.settings).map(
    (option) => option.value,
  );
  const result = VisitPlanSchema.safeParse(rawValues);

  if (!result.success) {
    return data(
      {
        success: false,
        values: rawValues,
        errors: result.error.flatten().fieldErrors,
      } satisfies VisitPlanActionData,
      { status: 400 },
    );
  }

  if (!serviceValues.includes(result.data.preferredService)) {
    return data(
      {
        success: false,
        values: rawValues,
        errors: {
          preferredService: ["Choose one of the listed service options"],
        },
      } satisfies VisitPlanActionData,
      { status: 400 },
    );
  }

  const submission = result.data;

  try {
    await deps.db.visitPlan.create({
      data: {
        name: submission.name,
        email: submission.email,
        phone: submission.phone || null,
        city: submission.city || null,
        preferredService: submission.preferredService,
        visitDate: submission.visitDate
          ? new Date(`${submission.visitDate}T00:00:00`)
          : null,
        adultCount: submission.adultCount,
        isFirstTimeGuest: submission.isFirstTimeGuest === "yes",
        bringingKids: submission.bringingKids,
        kidsCount: submission.bringingKids ? submission.kidsCount ?? null : null,
        kidsDetails: submission.bringingKids ? submission.kidsDetails || null : null,
        wantsUsherFollowUp: submission.wantsUsherFollowUp,
        wantsPastorFollowUp: submission.wantsPastorFollowUp,
        notes: submission.notes || null,
      },
    });
  } catch (error) {
    console.error("[visit-plan] Failed to save visit submission:", error);
    return data(
      {
        success: false,
        values: rawValues,
        globalError:
          "We couldn't save your visit details right now. Please try again or contact the church directly.",
      } satisfies VisitPlanActionData,
      { status: 500 },
    );
  }

  if (deps.resendApiKey) {
    const firstName = submission.name.trim().split(/\s+/)[0] ?? submission.name;
    const emailJobs = [
      deps.notifyAdminOfVisitPlan({
        name: submission.name,
        email: submission.email,
        phone: submission.phone || null,
        city: submission.city || null,
        preferredService: submission.preferredService,
        visitDate: submission.visitDate || null,
        adultCount: submission.adultCount,
        isFirstTimeGuest: submission.isFirstTimeGuest === "yes",
        bringingKids: submission.bringingKids,
        kidsCount: submission.kidsCount ?? null,
        kidsDetails: submission.kidsDetails || null,
        wantsUsherFollowUp: submission.wantsUsherFollowUp,
        wantsPastorFollowUp: submission.wantsPastorFollowUp,
        notes: submission.notes || null,
      }),
      deps.sendVisitPlanConfirmation({
        to: submission.email,
        firstName,
        preferredService: submission.preferredService,
        visitDate: submission.visitDate || undefined,
        bringingKids: submission.bringingKids,
        wantsUsherFollowUp: submission.wantsUsherFollowUp,
        wantsPastorFollowUp: submission.wantsPastorFollowUp,
      }),
    ];

    const emailResults = await Promise.allSettled(emailJobs);
    const emailFailure = emailResults.find((job) => job.status === "rejected");
    if (emailFailure?.status === "rejected") {
      console.error("[visit-plan] Email send failed:", emailFailure.reason);
    }
  }

  return {
    success: true,
    name: submission.name,
    preferredService: submission.preferredService,
    visitDate: submission.visitDate || null,
    bringingKids: submission.bringingKids,
    wantsUsherFollowUp: submission.wantsUsherFollowUp,
    wantsPastorFollowUp: submission.wantsPastorFollowUp,
  } satisfies VisitPlanActionData;
}
