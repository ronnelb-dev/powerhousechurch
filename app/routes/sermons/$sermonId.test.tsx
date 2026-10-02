// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/db.server", () => ({ db: {} }));

async function renderSermonPage() {
  const { default: SermonDetailPage } = await import("~/routes/sermons/$sermonId");
  const router = createMemoryRouter(
    [
      {
        path: "/preaching/:preachingId",
        element: <SermonDetailPage />,
        loader: () => ({
          sermon: {
            id: "sermon_1",
            title: "Abide in Me",
            speaker: "Pastor Ronnel Barashari",
            date: "2026-08-17T00:00:00.000Z",
            series: "John 15",
            tags: ["abide", "fruitfulness"],
            thumbnail: null,
            videoUrl: null,
            audioUrl: null,
            notes: "Preaching notes",
            weeklyGuide: "Read John 15 each day.",
            reflectionPrompts: "What does abiding look like?\nWhere do you need pruning?",
            scriptureFocus: "John 15:5",
          },
        }),
      },
    ],
    { initialEntries: ["/preaching/sermon_1"] },
  );

  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { name: "Abide in Me" });
}

describe("sermon guide links", () => {
  it("keeps the guide content without any Community CTA", async () => {
    await renderSermonPage();

    expect(screen.getByRole("heading", { name: "Weekly Guide" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Reflect in Community/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open Community/i })).not.toBeInTheDocument();
  });
});
