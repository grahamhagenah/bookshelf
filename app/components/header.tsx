
import { Link } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import logo from "~/images/logo.svg";
import type { LoaderFunctionArgs  } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import { getUserById } from "~/models/user.server";
import Search from "./search"
import PositionedMenu from './menu'
import Notifications from './notifications'


export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  // Add logic to determine whether or not there is a "friednId param"
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return {user};
}

export default function Header() {

  const data = useLoaderData<typeof loader>();

  console.log(data.user)

  return (
    <header className="w-full flex items-center justify-between">
      <Link id="logo" to="/books">
        <img src={logo} className="rounded-lg" alt="Lend"/>
        <h1 className="text-4xl font-semibold">Lend</h1>
      </Link>
      <h2 className="text-4xl font-semibold">{data.user.firstname}</h2>
      <div className="flex">
        {data.user && <Search />}
        {data.user && <Notifications />}
        <PositionedMenu/>
      </div>
    </header>
)}