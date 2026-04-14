import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { db } from "./db.server";

const adapter = new PrismaAdapter(db.session, db.user);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes(attributes) {
    return {
      email: attributes.email,
      firstName: attributes.firstName,
      lastName: attributes.lastName,
      role: attributes.role,
      cellGroupId: attributes.cellGroupId,
    };
  },
});

// Type augmentation — tells TypeScript what shape session.user has
declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string | null;
      firstName: string;
      lastName: string;
      role: "ADMIN" | "CELL_LEADER" | "MEMBER";
      cellGroupId: string | null;
    };
  }
}

/**
 * Call in any loader that needs to know who is logged in.
 * Returns { user, session } or { user: null, session: null }.
 */
export async function getSession(request: Request) {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const sessionId = lucia.readSessionCookie(cookieHeader);

  if (!sessionId) return { user: null, session: null };

  const result = await lucia.validateSession(sessionId);
  return result;
}

/**
 * Use in portal layout loader. Redirects to /auth/login if not authenticated.
 */
export async function requireUser(request: Request) {
  const { user, session } = await getSession(request);
  if (!user || !session) {
    throw new Response(null, {
      status: 302,
      headers: { Location: "/auth/login" },
    });
  }
  return { user, session };
}

/**
 * Use in admin-only routes.
 */
export async function requireAdmin(request: Request) {
  const { user, session } = await requireUser(request);
  if (user.role !== "ADMIN") {
    throw new Response("Forbidden", { status: 403 });
  }
  return { user, session };
}