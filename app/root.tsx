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
import { useEffect } from "react";

import { seo } from "~/seo";
import { getUser } from "~/session.server";
import { sharePromptDismissed } from "~/share-prompt.server";
import stylesheet from "~/styles/tailwind.css";
import { themeOf } from "~/utils";

import DemoBanner from "./components/demo-banner";
import Footer from "./components/footer";
import Header from "./components/header";
import SharePrompt from "./components/share-prompt";

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
  const user = await getUser(request);
  return json({
    user,
    // Invite people without a public link yet, until they say no thanks
    sharePrompt: Boolean(user && !user.shareToken && !sharePromptDismissed(request)),
  });
};

// For "match my device": goes dark before the first paint, so a dark
// device never sees a flash of white. The effect below keeps it in step
// after that.
const FOLLOW_DEVICE = `if (matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.classList.add("dark")`;

export default function App() {
  const { user, sharePrompt } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const theme = themeOf(user);

  useEffect(() => {
    if (theme !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => document.documentElement.classList.toggle("dark", media.matches);
    follow();
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [theme]);
  // Not on the account page, which has its own sharing section, or on
  // home, where a new account's welcome steps include sharing
  const showSharePrompt =
    sharePrompt && pathname !== "/account" && pathname !== "/";

  return (
    // The class can differ from the server's when following the device
    <html lang="en" className={`h-full ${theme === "dark" ? "dark" : ""}`} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        {theme === "system" ? <script dangerouslySetInnerHTML={{ __html: FOLLOW_DEVICE }} /> : null}
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {theme === "system" ? (
          <>
            <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0c0a09" />
            <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
          </>
        ) : (
          <meta name="theme-color" content={theme === "dark" ? "#0c0a09" : "#ffffff"} />
        )}
        <Meta />
        <Links />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors">
        <Header />
        {user?.demoGroup ? <DemoBanner /> : null}
        {user ? <SharePrompt show={showSharePrompt} /> : null}
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
