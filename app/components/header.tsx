
import { Link } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import logo from "~/images/logo.svg";
import type { LoaderFunctionArgs  } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import { getUserById } from "~/models/user.server";
import Search from "./search"
import PositionedMenu from './menu'
import Notifications from './notifications'


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return {user};
}

export default function Header() {

  const user = useLoaderData<typeof loader>();

  return (
    <header className="w-full flex items-center justify-between">
      <Link id="logo" to="/books">
        <img src={logo} className="rounded-lg" alt="Lend"/>
        <h1 className="text-4xl font-semibold">Lend</h1>
      </Link>
      <div className="flex">
        {user && <Search />}
        {user && <Notifications />}
        <PositionedMenu/>
      </div>
    </header>
)}