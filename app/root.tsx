import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import Header from './components/header'
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration,
} from "@remix-run/react";
import { getUser } from "~/session.server";
import stylesheet from "~/styles/tailwind.css";

export const meta: MetaFunction = () => [
  { title: "Stacks - Your Lending Library" },
  { name: "description", content: "Share and borrow books with friends" },
];

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  // Preconnect to Open Library for faster cover image loads
  { rel: "preconnect", href: "https://covers.openlibrary.org" },
  { rel: "dns-prefetch", href: "https://covers.openlibrary.org" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ user: await getUser(request) });
};

export default function App() {


  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full mt-2 md:mt-0">
        <Header /> 
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
