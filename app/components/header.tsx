
import { Link } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import logo from "~/images/logo.svg";
import type { LoaderFunctionArgs  } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import { getUserById } from "~/models/user.server";
import Search from "./search"
import PositionedMenu from './menu'
import Notifications from './notifications'
import { useMatches } from "@remix-run/react";


export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return {user};
}

export default function Header() {

  const matches = useMatches();
  const data = useLoaderData<typeof loader>();

  return (
    <header className="w-full flex items-center justify-between">
      <div className="flex w-full">
        <Link id="logo" to="/books">
          <img src={logo} className="rounded-lg" alt="Lend"/>
          <h1 className="text-3xl font-medium">Lend</h1>
        </Link>
        {/* <ol>
          {matches
            .filter(
              (match) =>
                match.handle && match.handle.breadcrumb
            )
            .map((match, index) => (
              <li key={index}>
                {match.handle.breadcrumb(match)}
              </li>
            ))}
          </ol> */}
      </div>
      {/* <h2 className="text-4xl font-semibold">{data.user.firstname}</h2> */}
      <div className="flex">
        {data.user && <Search />}
        {data.user && <Notifications />}
        <PositionedMenu/>
      </div>
    </header>
)}