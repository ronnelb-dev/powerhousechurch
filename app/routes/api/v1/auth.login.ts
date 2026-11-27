import { z } from "zod";
import { db } from "~/lib/db.server";
import { lucia } from "~/lib/auth.server";
import { verifyPassword } from "~/lib/password-hash.server";
import { authRateLimiter, getClientIpAddress } from "~/lib/rate-limit.server";

const LoginSchema = z.object({
  identifier: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
});

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const parsed = LoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Username, email, or phone and password are required." }, { status: 400 });
  }
  const limit = authRateLimiter.consume({
    bucket: "auth:api-login",
    key: `${getClientIpAddress(request)}:${parsed.data.identifier.toLowerCase()}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.ok) {
    return Response.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const user = await db.user.findFirst({
    where: {
      isActive: true,
      OR: [
        { email: parsed.data.identifier.toLowerCase() },
        { phone: parsed.data.identifier },
        { username: parsed.data.identifier.toLowerCase() },
      ],
    },
  });
  if (
    !user ||
    !user.isEmailVerified ||
    !(await verifyPassword(user.passwordHash, parsed.data.password))
  ) {
    return Response.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const session = await lucia.createSession(user.id, {});
  return Response.json(
    {
      token: session.id,
      tokenType: "Bearer",
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
