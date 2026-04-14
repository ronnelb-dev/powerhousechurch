// app/routes/auth/logout.tsx
// Action-only route — no UI rendered.
import { type ActionFunctionArgs, redirect } from "react-router";
import { lucia, getSession } from "~/lib/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await getSession(request);

  if (session) {
    await lucia.invalidateSession(session.id);
  }

  const blankCookie = lucia.createBlankSessionCookie();
  return redirect("/auth/login", {
    headers: { "Set-Cookie": blankCookie.serialize() },
  });
}

// GET requests to /auth/logout just redirect home
export async function loader() {
  return redirect("/");
}