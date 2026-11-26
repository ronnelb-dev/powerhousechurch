import { redirect, type LoaderFunctionArgs } from "react-router";

export function loader(_args: LoaderFunctionArgs) {
  return redirect("/");
}

