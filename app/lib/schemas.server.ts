import { z } from "zod";

// ── Auth ───────────────────────────────────────────────────
export const RegisterSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName:  z.string().min(1, "Last name is required").max(50),
  email:     z.string().email("Invalid email address").optional().or(z.literal("")),
  phone:     z.string().regex(/^[0-9+\s\-()]{7,20}$/, "Invalid phone number").optional().or(z.literal("")),
  password:  z.string().min(8, "Password must be at least 8 characters")
               .regex(/[A-Z]/, "Must contain an uppercase letter")
               .regex(/[0-9]/, "Must contain a number"),
  age:       z.coerce.number().int().min(5).max(120),
  gender:    z.enum(["MALE", "FEMALE"]),
  birthday:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use format YYYY-MM-DD"),
}).refine(
  (data) => data.email || data.phone,
  { message: "Either email or phone is required", path: ["email"] }
);

export const LoginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password:   z.string().min(1, "Password is required"),
});

// ── Prayer Request ─────────────────────────────────────────
export const PrayerRequestSchema = z.object({
  name:      z.string().min(1).max(100),
  email:     z.string().email().optional().or(z.literal("")),
  request:   z.string().min(10, "Please share a bit more").max(2000),
  isPrivate: z.coerce.boolean().default(false),
  honeypot:  z.string().max(0, "Bot detected").default(""),  // must be empty
});

// ── Contact Form ───────────────────────────────────────────
export const ContactFormSchema = z.object({
  name:     z.string().min(1).max(100),
  email:    z.string().email(),
  subject:  z.string().min(1).max(200),
  message:  z.string().min(10).max(3000),
  honeypot: z.string().max(0, "Bot detected").default(""),
});

// ── Visit Planning ────────────────────────────────────────
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
}).superRefine((data, ctx) => {
  if (data.visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.visitDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["visitDate"],
      message: "Choose a valid visit date",
    });
  }

  if (data.visitDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (data.visitDate < today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visitDate"],
        message: "Visit date cannot be in the past",
      });
    }
  }

  if (data.bringingKids && !data.kidsCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["kidsCount"],
      message: "Tell us how many kids are coming",
    });
  }
});

// ── Attendance ─────────────────────────────────────────────
export const MarkAttendanceSchema = z.object({
  userId:  z.string().cuid(),
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type:    z.enum(["SUNDAY_SERVICE", "CELL_GROUP"]),
  status:  z.enum(["PRESENT", "ABSENT"]),
});

// ── Devotion Post ──────────────────────────────────────────
export const CreatePostSchema = z.object({
  bibleVerse: z.string().max(100).optional().or(z.literal("")),
  bibleText:  z.string().max(500).optional().or(z.literal("")),
  content:    z.string().min(10, "Please write at least a sentence").max(2000),
  scope:      z.enum(["PUBLIC", "CELL_GROUP"]).default("PUBLIC"),
});

export const CreateCommentSchema = z.object({
  postId:  z.string().cuid(),
  content: z.string().min(1).max(500),
});

// ── Sermon (Admin) ─────────────────────────────────────────
export const SermonSchema = z.object({
  title:       z.string().min(1).max(200),
  speaker:     z.string().min(1).max(100),
  series:      z.string().max(100).optional().or(z.literal("")),
  videoUrl:    z.string().url().optional().or(z.literal("")),
  audioUrl:    z.string().url().optional().or(z.literal("")),
  notes:       z.string().optional().or(z.literal("")),
  scriptureFocus: z.string().max(200).optional().or(z.literal("")),
  weeklyGuide: z.string().max(4000).optional().or(z.literal("")),
  reflectionPrompts: z.string().max(2000).optional().or(z.literal("")),
  thumbnail:   z.string().url().optional().or(z.literal("")),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tags:        z.string().max(200).default(""),
  isPublished: z.coerce.boolean().default(true),
});

// ── Giving ─────────────────────────────────────────────────
export const GivingSchema = z.object({
  amount:   z.coerce.number().int().min(100, "Minimum giving is ₱1.00"),  // in centavos
  category: z.enum(["TITHE", "OFFERING", "MISSIONS", "BUILDING_FUND"]),
  name:     z.string().max(100).optional().or(z.literal("")),
  email:    z.string().email().optional().or(z.literal("")),
});

// ── Shared types inferred from schemas ────────────────────
export type RegisterInput     = z.infer<typeof RegisterSchema>;
export type LoginInput        = z.infer<typeof LoginSchema>;
export type PrayerRequestInput = z.infer<typeof PrayerRequestSchema>;
export type VisitPlanInput    = z.infer<typeof VisitPlanSchema>;
export type CreatePostInput   = z.infer<typeof CreatePostSchema>;
export type MarkAttendanceInput = z.infer<typeof MarkAttendanceSchema>;
export type SermonInput       = z.infer<typeof SermonSchema>;
export type GivingInput       = z.infer<typeof GivingSchema>;
