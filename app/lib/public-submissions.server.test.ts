import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VISIT_FORM_VALUES,
  handleContactSubmission,
  handlePrayerRequestSubmission,
  handleRsvpSubmission,
  handleVisitPlanSubmission,
} from "~/lib/public-submissions.server";

describe("handleRsvpSubmission", () => {
  it("waitlists registrations after capacity is reached", async () => {
    const createRegistration = vi.fn().mockResolvedValue(undefined);
    const sendConfirmation = vi.fn().mockResolvedValue(undefined);

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
        sendEventRegistrationConfirmation: sendConfirmation,
        buildEventCalendarUrl: vi.fn().mockReturnValue("https://church.test/ics"),
        buildGoogleCalendarUrl: vi.fn().mockReturnValue("https://calendar.test"),
      },
    );

    expect(createRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "WAITLISTED" }),
      }),
    );
    expect(sendConfirmation).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      eventId: "event_1",
      status: "WAITLISTED",
      message:
        "The event is full, so you have been added to the waitlist. A confirmation email is on its way.",
    });
  });
});

describe("visitor submissions", () => {
  it("sends contact messages through the injected sender", async () => {
    const sendContactEmail = vi.fn().mockResolvedValue(undefined);

    const result = await handleContactSubmission(
      {
        name: "Jane Doe",
        email: "jane@example.com",
        subject: "Need directions",
        message: "Could someone share the best entrance to use on Sunday?",
        honeypot: "",
      },
      {
        resendApiKey: "test-key",
        sendContactEmail,
      },
    );

    expect(sendContactEmail).toHaveBeenCalledWith({
      name: "Jane Doe",
      email: "jane@example.com",
      subject: "Need directions",
      message: "Could someone share the best entrance to use on Sunday?",
      honeypot: "",
    });
    expect(result).toEqual({ success: true });
  });

  it("stores prayer requests and only emails confirmations when an address is present", async () => {
    const createPrayerRequest = vi.fn().mockResolvedValue(undefined);
    const notifyAdmin = vi.fn().mockResolvedValue(undefined);
    const sendConfirmation = vi.fn().mockResolvedValue(undefined);

    const result = await handlePrayerRequestSubmission(
      {
        name: "Jane Doe",
        email: "",
        request: "Please pray for wisdom for our family this week.",
        isPrivate: true,
        honeypot: "",
      },
      {
        userId: "member_1",
        db: {
          prayerRequest: {
            create: createPrayerRequest,
          },
        },
        notifyAdminOfPrayerRequest: notifyAdmin,
        sendPrayerRequestConfirmation: sendConfirmation,
      },
    );

    expect(createPrayerRequest).toHaveBeenCalledWith({
      data: {
        memberId: "member_1",
        name: "Jane Doe",
        email: null,
        request: "Please pray for wisdom for our family this week.",
        isPrivate: true,
      },
    });
    expect(notifyAdmin).toHaveBeenCalledWith(
      "Jane Doe",
      "Please pray for wisdom for our family this week.",
      true,
    );
    expect(sendConfirmation).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("stores visit plans and sends both admin and guest emails when email is configured", async () => {
    const createVisitPlan = vi.fn().mockResolvedValue(undefined);
    const notifyAdmin = vi.fn().mockResolvedValue(undefined);
    const sendConfirmation = vi.fn().mockResolvedValue(undefined);

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
        resendApiKey: "test-key",
        notifyAdminOfVisitPlan: notifyAdmin,
        sendVisitPlanConfirmation: sendConfirmation,
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
    expect(notifyAdmin).toHaveBeenCalled();
    expect(sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        firstName: "Jane",
        preferredService: "Sunday 7:00 AM",
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
