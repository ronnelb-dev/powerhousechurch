import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export function loader({ params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.search;
  return redirect(`/preaching/${params.sermonId ?? ""}${search}`);
}

