import { cssBundleHref } from "@remix-run/css-bundle";
import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useMatches,
} from "@remix-run/react";
import { useEffect } from "react";

import { OLD_HOSTS, SITE_URL, seo } from "~/seo";
import { getUser } from "~/session.server";
import { sharePromptDismissed } from "~/share-prompt.server";
import stylesheet from "~/styles/tailwind.css";
import { themeOf } from "~/utils";

import Breadcrumbs from "./components/breadcrumbs";
import DemoBanner from "./components/demo-banner";
import ErrorPage from "./components/error-page";
import Footer from "./components/footer";
import Header from "./components/header";
import SharePrompt from "./components/share-prompt";
import VerifyEmailBanner from "./components/verify-email-banner";

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
  // And the wordmark's, which is on every page
  {
    rel: "preload",
    href: "/fonts/source-serif-4-latin-600-normal.woff2",
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
  // The site moved to bookstacks.app; old addresses (and www) go there for
  // good, path and all, so shared and invite links keep working
  const host = request.headers.get("host")?.split(":")[0];
  if (host && OLD_HOSTS.includes(host)) {
    const url = new URL(request.url);
    throw redirect(`${SITE_URL}${url.pathname}${url.search}`, 301);
  }
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
  // A page that stands on its own (a public shelf) leaves out the app's
  // header, banners and breadcrumbs, and keeps the footer
  const standalone = useMatches().some(
    (match) => (match.handle as { standalone?: boolean } | undefined)?.standalone,
  );

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
    // The background goes on <html> too: Safari paints the strip behind its
    // status bar and the overscroll above the page from it, not from <body>
    <html
      lang="en"
      className={`h-full bg-white dark:bg-stone-950 ${theme === "dark" ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        {theme === "system" ? <script dangerouslySetInnerHTML={{ __html: FOLLOW_DEVICE }} /> : null}
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {/* Tells the browser which way to paint its own canvas before the
            stylesheet arrives, so a dark page doesn't start out white */}
        <meta
          name="color-scheme"
          content={theme === "system" ? "light dark" : theme}
        />
        {/* Other sites' images and links don't learn which page was open */}
        <meta name="referrer" content="same-origin" />
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
      {/* No color transition here: Safari can resolve styles once before
          the stylesheet loads and then animate the page from white to dark */}
      <body className="min-h-full flex flex-col bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100">
        {standalone ? null : (
          <>
            <Header />
            {user?.demoGroup ? <DemoBanner /> : null}
            {user && !user.demoGroup && !user.emailVerifiedAt ? (
              <VerifyEmailBanner email={user.email} />
            ) : null}
            {user ? <SharePrompt show={showSharePrompt} /> : null}
          </>
        )}
        {/* One shared page width; the header and banner backgrounds stay full-bleed */}
        <div className="mx-auto w-full max-w-5xl flex-1">
          {standalone ? null : <Breadcrumbs />}
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

// A page the app itself couldn't serve (an address that goes nowhere, a
// loader that threw): the same header and footer, around the error page.
// Nothing is known about the viewer here, so the look follows the device.
export function ErrorBoundary() {
  return (
    <html lang="en" className="h-full bg-white dark:bg-stone-950" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <script dangerouslySetInnerHTML={{ __html: FOLLOW_DEVICE }} />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100">
        <Header />
        <div className="mx-auto w-full max-w-5xl flex-1">
          <ErrorPage />
        </div>
        <Footer />
        <Scripts />
      </body>
    </html>
  );
}
