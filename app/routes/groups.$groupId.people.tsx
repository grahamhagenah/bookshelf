import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

// The People tab became About; links to it still land there
export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  return redirect(`${url.pathname.replace(/\/people\/?$/, "/about")}${url.search}`);
};
