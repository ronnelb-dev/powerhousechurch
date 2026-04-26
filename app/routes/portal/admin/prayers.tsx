import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";

function buildCareRedirect(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);
  if (params.get("archive") === "true") {
    params.set("bucket", "archive");
  }
  params.delete("archive");
  params.set("source", "prayer");

  const query = params.toString();
  return redirect(query ? `/portal/care?${query}` : "/portal/care?source=prayer");
}

export async function loader({ request }: LoaderFunctionArgs) {
  throw buildCareRedirect(request);
}

export async function action({ request }: ActionFunctionArgs) {
  throw buildCareRedirect(request);
}

export default function AdminPrayersRedirect() {
  return null;
}
