import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VISIT_FORM_VALUES,
  handleContactSubmission,
  handlePrayerRequestSubmission,
  handleRsvpSubmission,
  handleVisitPlanSubmission,
} from "~/lib/public-submissions.server";

describe("handleRsvpSubmission", () => {
  it("requires guest contact details before opening a transaction", async () => {
    const transaction = vi.fn();

    const result = await handleRsvpSubmission(
      {
        intent: "rsvp",
        eventId: "event_1",
        name: "",
        email: "not-an-email",
        phone: "",
        notes: "",
        honeypot: "",
      },
      "https://church.test/events",
      {
        db: { $transaction: transaction },
        buildEventCalendarUrl: vi.fn(),
        buildGoogleCalendarUrl: vi.fn(),
      },
    );

    expect(transaction).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      eventId: "event_1",
      errors: {
        name: expect.any(Array),
        email: expect.any(Array),
        phone: expect.any(Array),
      },
    });
  });

  it("rejects a duplicate guest email for the same event", async () => {
    const createRegistration = vi.fn();

    const result = await handleRsvpSubmission(
      {
        intent: "rsvp",
        eventId: "event_1",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "09123456789",
        notes: "",
        honeypot: "",
      },
      "https://church.test/events",
      {
        db: {
          $transaction: async (fn) => fn({
            $queryRaw: vi.fn().mockResolvedValue([{ id: "event_1" }]),
            event: {
              findUnique: vi.fn().mockResolvedValue({
                id: "event_1",
                isPublished: true,
                requiresRegistration: true,
                startDate: new Date(Date.now() + 86_400_000),
                registrationDeadline: null,
              }),
            },
            eventRegistration: {
              findUnique: vi.fn().mockResolvedValue({ id: "registration_1" }),
              count: vi.fn(),
              create: createRegistration,
            },
          }),
        },
        buildEventCalendarUrl: vi.fn(),
        buildGoogleCalendarUrl: vi.fn(),
      },
    );

    expect(createRegistration).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      eventId: "event_1",
      formError: "This email address is already registered for the event.",
      errors: {},
    });
  });

  it("waitlists registrations after capacity is reached", async () => {
    const createRegistration = vi.fn().mockResolvedValue(undefined);

    const result = await handleRsvpSubmission(
      {
        intent: "rsvp",
        eventId: "event_1",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "09123456789",
        notes: "",
        honeypot: "",
      },
      "https://church.test/events",
      {
        db: {
          $transaction: async (fn) =>
            fn({
              $queryRaw: vi.fn().mockResolvedValue([{ id: "event_1" }]),
              event: {
                findUnique: vi.fn().mockResolvedValue({
                  id: "event_1",
                  title: "Prayer Night",
                  description: "Gathering",
                  location: "Sanctuary",
                  startDate: new Date(Date.now() + 86_400_000),
                  endDate: null,
                  isPublished: true,
                  requiresRegistration: true,
                  capacity: 1,
                  registrationDeadline: null,
                }),
              },
              eventRegistration: {
                count: vi.fn().mockResolvedValue(1),
                findUnique: vi.fn().mockResolvedValue(null),
                create: createRegistration,
              },
            }),
        },
        buildEventCalendarUrl: vi.fn().mockReturnValue("https://church.test/ics"),
        buildGoogleCalendarUrl: vi.fn().mockReturnValue("https://calendar.test"),
      },
    );

    expect(createRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "WAITLISTED" }),
      }),
    );
    expect(result).toEqual({
      success: true,
      eventId: "event_1",
      status: "WAITLISTED",
      message:
        "The event is full, so you have been added to the waitlist.",
    });
  });
});

describe("visitor submissions", () => {
  it("accepts contact messages without email sending", async () => {
    const result = await handleContactSubmission(
      {
        name: "Jane Doe",
        email: "jane@example.com",
        subject: "Need directions",
        message: "Could someone share the best entrance to use on Sunday?",
        honeypot: "",
      },
      {
      },
    );

    expect(result).toEqual({ success: true });
  });

  it("stores prayer requests and only emails confirmations when an address is present", async () => {
    const createPrayerRequest = vi.fn().mockResolvedValue(undefined);
    const result = await handlePrayerRequestSubmission(
      {
        name: "Jane Doe",
        email: "",
        request: "Please pray for wisdom for our family this week.",
        isPrivate: true,
        honeypot: "",
      },
      {
        db: {
          prayerRequest: {
            create: createPrayerRequest,
          },
        },
      },
    );

    expect(createPrayerRequest).toHaveBeenCalledWith({
      data: {
        name: "Jane Doe",
        email: null,
        request: "Please pray for wisdom for our family this week.",
        isPrivate: true,
      },
    });
    expect(result).toEqual({ success: true });
  });

  it("stores visit plans without sending email", async () => {
    const createVisitPlan = vi.fn().mockResolvedValue(undefined);

    const result = await handleVisitPlanSubmission(
      {
        ...DEFAULT_VISIT_FORM_VALUES,
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "09123456789",
        preferredService: "Sunday 7:00 AM",
        visitDate: "2099-06-15",
        adultCount: "2",
        bringingKids: true,
        kidsCount: "1",
        kidsDetails: "Age 6",
        wantsUsherFollowUp: true,
      },
      {
        settings: {
          "service.sunday1": "7:00 AM",
          "service.sunday2": "9:00 AM",
        },
        db: {
          visitPlan: {
            create: createVisitPlan,
          },
        },
      },
    );

    expect(createVisitPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          preferredService: "Sunday 7:00 AM",
          adultCount: 2,
          bringingKids: true,
          kidsCount: 1,
        }),
      }),
    );
    expect(result).toEqual({
      success: true,
      name: "Jane Doe",
      preferredService: "Sunday 7:00 AM",
      visitDate: "2099-06-15",
      bringingKids: true,
      wantsUsherFollowUp: true,
      wantsPastorFollowUp: false,
    });
  });
});
