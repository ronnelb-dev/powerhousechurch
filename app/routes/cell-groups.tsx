// app/routes/cell-groups.tsx
import {
  useLoaderData,
  Form,
  useActionData,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { z } from "zod";
import { db } from "~/lib/db.server";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [
  { title: "Cell Groups — Powerhouse Church" },
  {
    name: "description",
    content:
      "Find a Powerhouse Church cell group near you. Small groups meet weekly for fellowship, prayer, and the Word.",
  },
];

export async function loader() {
  const cellGroups = await db.cellGroup.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, meetingDay: true,
      meetingTime: true, barangay: true,
      _count: { select: { members: true } },
    },
  });

  const barangays = [
    ...new Set(
      cellGroups.map((cg) => cg.barangay).filter(Boolean) as string[]
    ),
  ].sort();

  return { cellGroups, barangays };
}

const JoinRequestSchema = z.object({
  cellGroupId: z.string().cuid(),
  name:        z.string().min(1).max(100),
  phone:       z.string().min(7).max(20),
  message:     z.string().max(500).optional().or(z.literal("")),
});

type ActionData =
  | { success: true }
  | { success: false; errors: Record<string, string[]> };

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const raw = {
    cellGroupId: formData.get("cellGroupId") as string,
    name:        formData.get("name") as string,
    phone:       formData.get("phone") as string,
    message:     (formData.get("message") as string) ?? "",
  };

  const result = JoinRequestSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    } satisfies ActionData;
  }

  return { success: true } satisfies ActionData;
}

const inputClass =
  "w-full px-4 py-3 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all";

export default function CellGroupsPage() {
  const { cellGroups } = useLoaderData<typeof loader>();
  const actionData   = useActionData<typeof action>();
  const navigation   = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <>
      <PageHero
        title="Cell Groups"
        subtitle="Community is not a program. It's how we do life together, week by week."
        scripture="And let us consider how to stir up one another to love and good works, not neglecting to meet together. — Hebrews 10:24–25"
      />

      <div className="max-w-5xl mx-auto px-6 py-16">
        <SectionHeader
          eyebrow="Find Your People"
          title="Active Cell Groups"
          subtitle="Cell groups meet weekly in homes across the city. Find one near you."
        />

        {cellGroups.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cellGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white border border-gray-100 rounded-2xl p-6
                           hover:border-red-200 hover:shadow-sm transition-all"
              >
                <h3 className="font-serif text-xl font-bold text-gray-900 mb-3">
                  {group.name}
                </h3>
                <div className="space-y-1.5 mb-5">
                  {group.meetingDay && (
                    <p className="text-xs font-sans text-gray-500">
                      <span className="font-bold text-gray-700">Day: </span>
                      {group.meetingDay}
                      {group.meetingTime ? ` at ${group.meetingTime}` : ""}
                    </p>
                  )}
                  {group.barangay && (
                    <p className="text-xs font-sans text-gray-500">
                      <span className="font-bold text-gray-700">Area: </span>
                      {group.barangay}
                    </p>
                  )}
                  <p className="text-xs font-sans text-gray-500">
                    <span className="font-bold text-gray-700">Members: </span>
                    {group._count.members}
                  </p>
                </div>

                {actionData?.success ? (
                  <p className="text-xs font-sans font-bold text-green-600"
                     aria-live="polite">
                    ✓ Request sent! Your cell leader will reach out soon.
                  </p>
                ) : (
                  <details className="group">
                    <summary
                      className="text-xs font-sans font-bold text-red-700
                                 cursor-pointer hover:text-red-900 transition-colors
                                 focus:outline-none focus:underline list-none"
                    >
                      Request to join →
                    </summary>
                    <div className="mt-4 space-y-3">
                      <Form method="post">
                        <input type="hidden" name="cellGroupId" value={group.id} />
                        <input
                          type="text" name="name" placeholder="Your name"
                          required className={`${inputClass} mb-2`}
                        />
                        <input
                          type="tel" name="phone" placeholder="Your phone number"
                          required className={`${inputClass} mb-2`}
                        />
                        <textarea
                          name="message" placeholder="Anything you'd like them to know (optional)"
                          rows={2} maxLength={500}
                          className={`${inputClass} resize-none mb-3`}
                        />
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-2.5 bg-red-700 text-white font-sans
                                     font-bold text-xs rounded-lg hover:bg-red-800
                                     disabled:opacity-60 transition-all"
                        >
                          {isSubmitting ? "Sending…" : "Send Request"}
                        </button>
                      </Form>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="members"
            title="Cell groups coming soon"
            message="Our cell group directory is being set up. Contact us to find a group near you."
            action={{ label: "Contact us", to: "/contact" }}
          />
        )}
      </div>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState
      icon="members"
      title="Could not load cell groups"
      message={
        isRouteErrorResponse(error) ? error.data : "Please refresh the page."
      }
      action={{ label: "Go home", to: "/" }}
    />
  );
}
