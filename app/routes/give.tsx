// app/routes/give.tsx
import {
  Form,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
  isRouteErrorResponse,
  useRouteError,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { useState } from "react";
import { z } from "zod";
import Stripe from "stripe";
import { PageHero } from "~/components/ui/PageHero";

export const meta: MetaFunction = () => [
  { title: "Give Online — Powerhouse Church" },
  {
    name: "description",
    content:
      "Support the mission of Powerhouse Church through tithes, offerings, and missions giving.",
  },
];

const GivingSchema = z.object({
  amount:   z.coerce.number().int().min(100, "Minimum giving is ₱1.00"),
  category: z.enum(["TITHE", "OFFERING", "MISSIONS", "BUILDING_FUND"]),
  name:     z.string().max(100).optional().or(z.literal("")),
  email:    z.string().email("Invalid email").optional().or(z.literal("")),
});

type ActionData =
  | { success: true; amount?: number }
  | { success: false; errors: Record<string, string[]> }
  | { success: false; globalError: string };

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const raw = {
    amount:   formData.get("amount") as string,
    category: formData.get("category") as string,
    name:     (formData.get("name") as string) ?? "",
    email:    (formData.get("email") as string) ?? "",
  };

  const result = GivingSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    } satisfies ActionData;
  }

  const { amount, category, name, email } = result.data;
  const currentUrl = new URL(request.url);
  const origin =
    process.env.APP_URL ||
    process.env.PUBLIC_APP_URL ||
    currentUrl.origin;

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      success: false,
      globalError:
        "Online giving is not yet configured. Please give in person or contact the church office.",
    } satisfies ActionData;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/give?status=success&amount=${amount}`,
    cancel_url: `${origin}/give?status=cancelled`,
    customer_email: email || undefined,
    metadata: {
      category,
      giverName: name || "Anonymous",
      giverEmail: email || "",
    },
    payment_intent_data: {
      description: `Powerhouse Church — ${category}`,
      metadata: {
        category,
        giverName: name || "Anonymous",
        giverEmail: email || "",
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "php",
          product_data: {
            name: `Powerhouse Church ${category.replaceAll("_", " ")}`,
          },
          unit_amount: amount,
        },
      },
    ],
  });

  if (!session.url) {
    return {
      success: false,
      globalError:
        "We couldn't start checkout right now. Please try again in a moment.",
    } satisfies ActionData;
  }

  return redirect(session.url);
}

const PRESETS = [
  { label: "₱100",   value: 10000 },
  { label: "₱500",   value: 50000 },
  { label: "₱1,000", value: 100000 },
  { label: "₱2,000", value: 200000 },
];

const CATEGORIES = [
  { value: "TITHE",         label: "Tithe",         desc: "Returning the first tenth to God" },
  { value: "OFFERING",      label: "Offering",      desc: "A freewill gift of worship" },
  { value: "MISSIONS",      label: "Missions",      desc: "Supporting global and local missions" },
  { value: "BUILDING_FUND", label: "Building Fund", desc: "Building our church home" },
];

const inputClass =
  "w-full px-4 py-3 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all";

const labelClass = "block text-sm font-sans font-bold text-gray-700 mb-1.5";

export default function GivePage() {
  const actionData  = useActionData<typeof action>();
  const navigation  = useNavigation();
  const [searchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";
  const isSuccess = searchParams.get("status") === "success";
  const isCancelled = searchParams.get("status") === "cancelled";
  const successfulAmount = Number(searchParams.get("amount") ?? "0");

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount]     = useState("");
  const [selectedCategory, setSelectedCategory] = useState("TITHE");

  // Success — show confirmation
  if (isSuccess && successfulAmount >= 100) {
    const displayAmount = (successfulAmount / 100).toLocaleString("en-PH", {
      style: "currency", currency: "PHP",
    });
    return (
      <div className="min-h-screen bg-primary-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div
            className="w-20 h-20 rounded-full bg-green-100 border border-green-200
                       flex items-center justify-center mx-auto mb-6"
            aria-live="polite"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                 stroke="#16a34a" strokeWidth="2" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="font-serif text-3xl font-bold text-gray-900 mb-3">
            Thank You for Your Generosity
          </h1>
          <p className="text-gray-500 font-sans text-base leading-relaxed mb-2">
            Your gift of{" "}
            <span className="font-bold text-gray-800">{displayAmount}</span>{" "}
            has been received.
          </p>
          <p className="font-serif italic text-gray-400 text-sm mb-8">
            "Each of you should give what you have decided in your heart to give,
            not reluctantly or under compulsion, for God loves a cheerful giver."
            <span className="block not-italic font-sans text-xs mt-1">
              2 Corinthians 9:7
            </span>
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-red-700 text-white font-sans
                       font-bold text-sm rounded-lg hover:bg-red-800 transition-colors"
          >
            Return Home
          </a>
        </div>
      </div>
    );
  }

  const errors = actionData?.success === false && "errors" in actionData
    ? actionData.errors : {};
  const globalError = actionData?.success === false && "globalError" in actionData
    ? actionData.globalError : null;

  // Compute the hidden amount field value (in centavos)
  const amountInCentavos =
    selectedPreset !== null
      ? selectedPreset
      : customAmount
      ? Math.round(parseFloat(customAmount.replace(/,/g, "")) * 100)
      : 0;

  return (
    <>
      <PageHero
        title="Give Online"
        subtitle="Every gift is an act of worship. Give cheerfully, give generously."
        scripture="Bring the whole tithe into the storehouse… and see if I will not open the floodgates of heaven. — Malachi 3:10"
      />

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Global error */}
        {globalError && (
          <div
            role="alert"
            className="mb-6 px-5 py-4 bg-amber-50 border border-amber-200
                       rounded-xl text-sm font-sans text-amber-800"
          >
            {globalError}
          </div>
        )}
        {isCancelled && !globalError && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm font-sans text-gray-700"
          >
            Checkout was canceled. Your card was not charged.
          </div>
        )}

        <Form method="post" noValidate aria-label="Online giving form">
          {/* Hidden amount field — carries centavo value */}
          <input type="hidden" name="amount" value={amountInCentavos || ""} />

          {/* Category */}
          <div className="mb-8">
            <p className={labelClass}>
              Giving Category <span className="text-red-500" aria-hidden="true">*</span>
            </p>
            <fieldset>
              <legend className="sr-only">Select giving category</legend>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.value}
                    className={[
                      "flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer",
                      "transition-all",
                      selectedCategory === cat.value
                        ? "border-red-600 bg-red-50"
                        : "border-gray-200 bg-white hover:border-red-200",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={cat.value}
                      checked={selectedCategory === cat.value}
                      onChange={() => setSelectedCategory(cat.value)}
                      className="mt-1 text-red-600 focus:ring-red-400"
                    />
                    <div>
                      <p className="text-sm font-sans font-bold text-gray-800">
                        {cat.label}
                      </p>
                      <p className="text-xs text-gray-400 font-sans mt-0.5">
                        {cat.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>
            {errors?.category && (
              <p role="alert" className="mt-2 text-xs text-red-600 font-sans">
                {errors.category[0]}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="mb-8">
            <p className={labelClass}>
              Amount <span className="text-red-500" aria-hidden="true">*</span>
            </p>

            {/* Preset buttons */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(preset.value);
                    setCustomAmount("");
                  }}
                  aria-pressed={selectedPreset === preset.value}
                  className={[
                    "py-3 rounded-xl border-2 font-sans font-bold text-sm",
                    "transition-all focus:outline-none focus:ring-2 focus:ring-red-300",
                    selectedPreset === preset.value
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-red-300",
                  ].join(" ")}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400
                           font-sans text-sm font-bold"
                aria-hidden="true"
              >
                ₱
              </span>
              <input
                type="text"
                placeholder="Custom amount"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedPreset(null);
                }}
                aria-label="Enter a custom giving amount in Philippine pesos"
                className={`${inputClass} pl-8`}
              />
            </div>

            {errors?.amount && (
              <p role="alert" className="mt-2 text-xs text-red-600 font-sans">
                {errors.amount[0]}
              </p>
            )}
          </div>

          {/* Optional giver info */}
          <div className="mb-8 space-y-4">
            <p className={labelClass}>
              Your Details
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </p>
            <input
              type="text"
              name="name"
              placeholder="Full name"
              className={inputClass}
              aria-label="Your full name (optional)"
            />
            <input
              type="email"
              name="email"
              placeholder="Email for receipt"
              className={inputClass}
              aria-label="Email address for receipt (optional)"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || amountInCentavos < 100}
            aria-busy={isSubmitting}
            aria-disabled={amountInCentavos < 100}
            className="w-full py-4 bg-red-700 text-white font-sans font-bold
                       text-sm tracking-wide rounded-xl hover:bg-red-800
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {isSubmitting
              ? "Processing…"
              : amountInCentavos >= 100
              ? `Give ${(amountInCentavos / 100).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}`
              : "Select an Amount"}
          </button>

          <p className="mt-4 text-center text-xs text-gray-400 font-sans">
            Secured by Stripe. Your card details are never stored on our servers.
          </p>
        </Form>

        {/* Scripture footer */}
        <div className="mt-12 text-center">
          <p className="font-serif italic text-gray-300 text-sm">
            "Honor the Lord with your wealth and with the firstfruits of all your produce."
            <span className="block not-italic font-sans text-xs mt-1 text-gray-400">
              Proverbs 3:9
            </span>
          </p>
        </div>
      </div>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
          Giving unavailable
        </h1>
        <p className="text-gray-500 text-sm">
          {isRouteErrorResponse(error) ? error.data : "Please try again."}
        </p>
      </div>
    </div>
  );
}
