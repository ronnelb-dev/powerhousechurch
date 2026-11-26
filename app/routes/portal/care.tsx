import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

function buildPrayerRequestsRedirect(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();

  if (
    url.searchParams.get("bucket") === "archive" ||
    url.searchParams.get("archive") === "true"
  ) {
    params.set("bucket", "archive");
  }
  for (const key of ["q", "ownerId", "due"]) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return redirect(
    query ? `/portal/admin/prayers?${query}` : "/portal/admin/prayers",
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  throw buildPrayerRequestsRedirect(request);
}

export async function action({ request }: ActionFunctionArgs) {
  throw buildPrayerRequestsRedirect(request);
}

export default function CareRedirect() {
  return null;
}
