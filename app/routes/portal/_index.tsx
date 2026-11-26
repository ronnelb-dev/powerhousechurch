import { redirect, type LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  throw redirect(`${url.pathname.replace(/\/$/, "")}/dashboard`);
}

export default function PortalIndexRedirect() {
  return null;
}
