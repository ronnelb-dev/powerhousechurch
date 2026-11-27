import { requireApiUser, lucia } from "~/lib/auth.server";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  const { session } = await requireApiUser(request);
  await lucia.invalidateSession(session.id);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
