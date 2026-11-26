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
import { useEffect, useRef } from "react";
import type { MetaFunction } from "react-router";
import { toast } from "react-toastify";
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
  "w-full rounded-xl border border-[var(--input)] bg-[var(--card)] px-4 py-3 text-sm font-sans text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] " +
  "transition-all focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export default function CellGroupsPage() {
  const { cellGroups } = useLoaderData<typeof loader>();
  const actionData   = useActionData<typeof action>();
  const navigation   = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const lastSuccessRef = useRef<object | null>(null);

  useEffect(() => {
    if (navigation.state === "submitting") {
      lastSuccessRef.current = null;
    }
  }, [navigation.state]);

  useEffect(() => {
    if (
      navigation.state !== "idle" ||
      !actionData?.success ||
      lastSuccessRef.current === actionData
    ) {
      return;
    }

    lastSuccessRef.current = actionData;
    toast.success("Request sent! Your cell leader will reach out soon.", {
      role: "status",
    });
  }, [actionData, navigation.state]);

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
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 transition-all hover:border-[var(--primary)]/35 hover:shadow-[var(--shadow-soft)]"
              >
                <h3 className="mb-3 font-serif text-xl font-bold text-[var(--foreground)]">
                  {group.name}
                </h3>
                <div className="space-y-1.5 mb-5">
                  {group.meetingDay && (
                    <p className="text-xs font-sans text-[var(--muted-foreground)]">
                      <span className="font-bold text-[var(--foreground)]">Day: </span>
                      {group.meetingDay}
                      {group.meetingTime ? ` at ${group.meetingTime}` : ""}
                    </p>
                  )}
                  {group.barangay && (
                    <p className="text-xs font-sans text-[var(--muted-foreground)]">
                      <span className="font-bold text-[var(--foreground)]">Area: </span>
                      {group.barangay}
                    </p>
                  )}
                  <p className="text-xs font-sans text-gray-500">
                    <span className="font-bold text-gray-700">Members: </span>
                    {group._count.members}
                  </p>
                </div>

                <details className="group">
                  <summary
                    className="list-none cursor-pointer text-xs font-sans font-bold text-[var(--primary)] transition-colors hover:brightness-75 focus-visible:rounded-sm focus-visible:underline"
                  >
                    Request to join →
                  </summary>
                  <div className="mt-4 space-y-3">
                    <Form method="post">
                      <input type="hidden" name="cellGroupId" value={group.id} />
                      <div className="mb-3">
                        <label htmlFor={`cell-group-name-${group.id}`} className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
                          Your name
                        </label>
                        <input
                          id={`cell-group-name-${group.id}`}
                          type="text"
                          name="name"
                          autoComplete="name"
                          required
                          className={inputClass}
                        />
                      </div>
                      <div className="mb-3">
                        <label htmlFor={`cell-group-phone-${group.id}`} className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
                          Phone number
                        </label>
                        <input
                          id={`cell-group-phone-${group.id}`}
                          type="tel"
                          name="phone"
                          autoComplete="tel"
                          required
                          className={inputClass}
                        />
                      </div>
                      <div className="mb-3">
                        <label htmlFor={`cell-group-message-${group.id}`} className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
                          Message <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
                        </label>
                        <textarea
                          id={`cell-group-message-${group.id}`}
                          name="message"
                          rows={2}
                          maxLength={500}
                          className={`${inputClass} resize-none`}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="min-h-11 w-full rounded-full bg-[var(--primary)] py-2.5 font-sans text-xs font-bold text-[var(--primary-foreground)] transition-all hover:brightness-110 disabled:opacity-60"
                      >
                        {isSubmitting ? "Sending…" : "Send Request"}
                      </button>
                    </Form>
                  </div>
                </details>
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
