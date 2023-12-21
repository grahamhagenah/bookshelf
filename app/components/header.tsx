
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
    <header className="w-full md:flex items-center justify-between">
      <div className="md:flex w-full">
        <Link id="logo" to="/books">
          <img src={logo} className="rounded-lg" alt="Lend"/>
          <h1 className="text-3xl font-medium">Lend</h1>
        </Link>
      </div>
      <div className="md:flex">
        {data.user && <Search />}
        <div className="absolute top-0 right-0 p-1 md:relative md:p-0 whitespace-nowrap mt-4 md:mt-0"> 
          {data.user && <Notifications />}
          <PositionedMenu/>
        </div>
      </div>
    </header>
)}