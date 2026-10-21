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
  useLocation,
} from "@remix-run/react";

import { seo } from "~/seo";
import { getUser } from "~/session.server";
import stylesheet from "~/styles/tailwind.css";

import DemoBanner from "./components/demo-banner";
import Footer from "./components/footer";
import Header from "./components/header";

// Fallback for any page without its own meta; those are signed-in pages
export const meta: MetaFunction = () => seo({ noindex: true });

export const links: LinksFunction = () => [
  // Start the body font straight away instead of after the stylesheet
  {
    rel: "preload",
    href: "/fonts/source-sans-3-latin-normal.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  { rel: "stylesheet", href: stylesheet },
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ user: await getUser(request) });
};

export default function App() {
  const { user } = useLoaderData<typeof loader>();
  const isDarkMode = user?.darkMode ?? false;
  // The logged-out landing page stands on its own, without the top bar
  const isLanding = useLocation().pathname === "/" && !user;

  return (
    <html lang="en" className={`h-full ${isDarkMode ? "dark" : ""}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" content={isDarkMode ? "#0c0a09" : "#ffffff"} />
        <Meta />
        <Links />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors">
        {isLanding ? null : <Header />}
        {user?.demoGroup ? <DemoBanner /> : null}
        {/* One shared page width; the header and banner backgrounds stay full-bleed */}
        <div className="mx-auto w-full max-w-5xl flex-1">
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
