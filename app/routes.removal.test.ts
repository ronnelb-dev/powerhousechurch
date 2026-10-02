import { describe, expect, it } from "vitest";
import routes from "./routes";

describe("removed portal routes", () => {
  it("does not register portal or authentication route modules", () => {
    const routeManifest = JSON.stringify(routes);

    expect(routeManifest).not.toContain("routes/portal/");
    expect(routeManifest).not.toContain("routes/auth/");
    expect(routeManifest).not.toContain('"path":"portal"');
    expect(routeManifest).not.toContain('"path":"auth"');
  });

  it("keeps the public event and prayer routes registered", () => {
    const routeManifest = JSON.stringify(routes);

    expect(routeManifest).toContain("routes/events.tsx");
    expect(routeManifest).toContain("routes/prayer-request.tsx");
  });
});
