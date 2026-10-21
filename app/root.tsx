import { cssBundleHref } from "@remix-run/css-bundle";
import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";

import { getUser } from "~/session.server";
import stylesheet from "~/styles/tailwind.css";

import DemoBanner from "./components/demo-banner";
import Footer from "./components/footer";
import Header from "./components/header";

export const meta: MetaFunction = () => [
  { title: "Stacks - Your Lending Library" },
  { name: "description", content: "Share and borrow books with friends" },
];

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  // Preconnect to Open Library for faster cover image loads
  { rel: "preconnect", href: "https://covers.openlibrary.org" },
  { rel: "dns-prefetch", href: "https://covers.openlibrary.org" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ user: await getUser(request) });
};

export default function App() {
  const { user } = useLoaderData<typeof loader>();
  const isDarkMode = user?.darkMode ?? false;

  return (
    <html lang="en" className={`h-full ${isDarkMode ? "dark" : ""}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors">
        <Header />
        {user?.demoGroup ? <DemoBanner /> : null}
        {/* One shared page width; the header and banner backgrounds stay full-bleed */}
        <div className="mx-auto w-full max-w-4xl flex-1">
          <Outlet />
        </div>
        <Footer />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
