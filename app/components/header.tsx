
import { Link } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
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
    <header className="w-full flex items-center justify-between shadow-sm px-4 md:px-8 py-2">
      <a id="logo" href="/books" className="text-3xl">
        📚
      </a>
      <div>
        <div className="hidden md:inline-block">
          {data.user && <Search />}
        </div>
        <div className="inline-block md:relative whitespace-nowrap"> 
          {data.user && <Notifications />}
          <PositionedMenu />
        </div>
      </div>
    </header>
)}