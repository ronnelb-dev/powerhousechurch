import { z } from "zod";

export const PrayerRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  request: z.string().min(10, "Please share a bit more").max(2000),
  isPrivate: z.coerce.boolean().default(false),
  honeypot: z.string().max(0, "Bot detected").default(""),
});

export const ContactFormSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(3000),
  honeypot: z.string().max(0, "Bot detected").default(""),
});

export const VisitPlanSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string()
    .regex(/^[0-9+\s\-()]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  city: z.string().max(120, "Keep this under 120 characters").optional().or(z.literal("")),
  preferredService: z.string().min(1, "Choose a preferred service"),
  visitDate: z.string().optional().or(z.literal("")),
  adultCount: z.coerce.number().int().min(1, "At least one adult is required").max(12, "Please contact us for larger groups"),
  isFirstTimeGuest: z.enum(["yes", "no"]),
  bringingKids: z.coerce.boolean().default(false),
  kidsCount: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.coerce.number().int().min(1, "Add at least one child").max(12, "Please contact us for larger family groups").optional(),
  ),
  kidsDetails: z.string().max(500, "Keep kids notes under 500 characters").optional().or(z.literal("")),
  wantsUsherFollowUp: z.coerce.boolean().default(false),
  wantsPastorFollowUp: z.coerce.boolean().default(false),
  notes: z.string().max(1000, "Keep notes under 1000 characters").optional().or(z.literal("")),
  honeypot: z.string().max(0, "Bot detected").default(""),
}).superRefine((submission, context) => {
  if (submission.visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(submission.visitDate)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["visitDate"],
      message: "Choose a valid visit date",
    });
  }

  if (submission.visitDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (submission.visitDate < today) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visitDate"],
        message: "Visit date cannot be in the past",
      });
    }
  }

  if (submission.bringingKids && !submission.kidsCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["kidsCount"],
      message: "Tell us how many kids are coming",
    });
  }
});
