import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  SerializeFrom,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";

import Layout from "~/components / Layout/Layout";
import {
  getAdminUsers,
  getDataQuality,
  getHealth,
  getLending,
  setAdmin,
} from "~/models/admin.server";
import { deleteExpiredDemoGroups } from "~/models/demo.server";
import { deleteUsers, isUserAdmin } from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

export const meta: MetaFunction = () => seo({ title: "Admin", noindex: true });

export const handle = {
  breadcrumb: () => <span>Admin Dashboard</span>,
};

async function requireAdmin(request: Request) {
  const userId = await requireUserId(request);
  if (!(await isUserAdmin(userId))) {
    throw new Response("Forbidden", { status: 403 });
  }
  return userId;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireAdmin(request);
  const [health, lending, users, quality] = await Promise.all([
    getHealth(),
    getLending(),
    getAdminUsers(),
    getDataQuality(),
  ]);
  return json({ userId, health, lending, users, quality });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "clearDemos") {
    await deleteExpiredDemoGroups();
    return json({ ok: true });
  }

  const targetId = form.get("userId");
  if (typeof targetId !== "string" || !targetId) {
    return json({ error: "No account given" }, { status: 400 });
  }
  // Admins can't lock themselves out or delete their own account here
  if (targetId === userId) {
    return json({ error: "You can't change your own account here" }, { status: 400 });
  }

  if (intent === "setAdmin") {
    await setAdmin(targetId, form.get("isAdmin") === "true");
    return json({ ok: true });
  }
  if (intent === "deleteUser") {
    await deleteUsers([targetId]);
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, { status: 400 });
};

type Data = SerializeFrom<typeof loader>;

const headingClass = "text-lg font-semibold text-stone-900 dark:text-stone-100";
const subheadingClass = "text-sm font-semibold text-stone-500 dark:text-stone-400";
const mutedClass = "text-stone-500 dark:text-stone-400";
const outlineButton =
  "rounded-md px-2.5 py-1 text-sm font-medium ring-1 ring-inset ring-stone-300 dark:ring-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-900 disabled:opacity-50 transition-colors";
const bookLink =
  "hover:underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600";

const DAY = 24 * 60 * 60 * 1000;
const shortDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// "today", "3d ago", "5w ago", or the month once it's older than a few months
function ago(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / DAY);
  if (days < 1) return "today";
  if (days < 14) return `${days}d ago`;
  if (days < 90) return `${Math.floor(days / 7)}w ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div>
      <dt className={`text-sm ${mutedClass}`}>{label}</dt>
      <dd className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-50">
          {value.toLocaleString()}
        </span>
        {note ? <span className={`text-sm ${mutedClass}`}>{note}</span> : null}
      </dd>
    </div>
  );
}

// A thin bar per day for the last 30 days. One series, so the title names
// it and there's no legend; hovering a day shows its count.
function DailyBars({
  title,
  total,
  days,
  noun,
}: {
  title: string;
  total: number;
  days: { day: string; count: number }[];
  noun: [string, string];
}) {
  const peak = Math.max(...days.map((d) => d.count));
  const max = Math.max(1, peak);
  const label = (count: number) => `${count} ${count === 1 ? noun[0] : noun[1]}`;
  // Noon UTC, so the date reads the same in every timezone
  const dayDate = (day: string) => shortDate(`${day}T12:00:00Z`);
  return (
    <figure>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className={subheadingClass}>{title}</span>
        <span className={`text-sm tabular-nums ${mutedClass}`}>{total} in 30 days</span>
      </figcaption>
      <div className="relative mt-3 flex h-24 items-end gap-0.5 border-b border-stone-200 dark:border-stone-800">
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-sm bg-stone-400 group-hover:bg-stone-600 dark:bg-stone-500 dark:group-hover:bg-stone-300"
              style={{ height: d.count ? `${(d.count / max) * 100}%` : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-stone-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-stone-100 dark:text-stone-900">
              {dayDate(d.day)}: {label(d.count)}
            </div>
          </div>
        ))}
      </div>
      <div className={`mt-1 flex justify-between text-xs ${mutedClass}`}>
        <span>{dayDate(days[0].day)}</span>
        {peak ? <span>Busiest day: {label(peak)}</span> : null}
        <span>Today</span>
      </div>
      {/* The same numbers for screen readers */}
      <table className="sr-only">
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Health({ health }: { health: Data["health"] }) {
  return (
    <section aria-labelledby="health">
      <h2 id="health" className={headingClass}>
        Health
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="People" value={health.users} note={`+${health.newUsers7} this week`} />
        <Stat label="Books" value={health.books} note={`+${health.booksAdded7} this week`} />
        <Stat
          label="On loan"
          value={health.onLoan}
          note={health.overdue ? `${health.overdue} overdue` : undefined}
        />
        <Stat label="Friendships" value={health.friendships} />
        <Stat label="Demo visits today" value={health.demosToday} />
      </dl>
      <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-10">
        <DailyBars
          title="Sign-ups"
          total={health.newUsers30}
          days={health.signupsPerDay}
          noun={["sign-up", "sign-ups"]}
        />
        <DailyBars
          title="Loans started"
          total={health.loansStarted30}
          days={health.loansPerDay}
          noun={["loan", "loans"]}
        />
      </div>
    </section>
  );
}

function RankedList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; label: React.ReactNode; sub?: string; value: number }[];
  empty: string;
}) {
  return (
    <div>
      <h3 className={subheadingClass}>{title}</h3>
      {rows.length ? (
        <ol className="mt-2 space-y-1.5 text-sm">
          {rows.map((row) => (
            <li key={row.key} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-stone-800 dark:text-stone-200">
                {row.label}
                {row.sub ? <span className={mutedClass}> · {row.sub}</span> : null}
              </span>
              <span className={`tabular-nums ${mutedClass}`}>{row.value}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={`mt-2 text-sm ${mutedClass}`}>{empty}</p>
      )}
    </div>
  );
}

function Lending({ lending }: { lending: Data["lending"] }) {
  return (
    <section aria-labelledby="lending">
      <h2 id="lending" className={headingClass}>
        Lending
      </h2>
      <div className="mt-4">
        <h3 className={subheadingClass}>Overdue</h3>
        {lending.overdue.length ? (
          <ul className="mt-2 divide-y divide-stone-100 text-sm dark:divide-stone-800">
            {lending.overdue.map((book) => {
              const late = Math.max(
                1,
                Math.floor((Date.now() - new Date(book.dueDate ?? 0).getTime()) / DAY),
              );
              return (
                <li key={book.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <Link
                      to={`/books/${book.id}`}
                      className={`font-medium text-stone-900 dark:text-stone-100 ${bookLink}`}
                    >
                      {book.title}
                    </Link>
                    <span className={mutedClass}>
                      {" "}
                      · {book.user.firstname} lent to {book.borrower?.firstname}{" "}
                      {book.borrower?.surname}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-medium tabular-nums text-stone-700 dark:text-stone-300">
                    {late}d late
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={`mt-2 text-sm ${mutedClass}`}>Nothing overdue.</p>
        )}
      </div>
      <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-10">
        <RankedList
          title="Most lent books"
          empty="No loans yet."
          rows={lending.mostLent.map((book) => ({
            key: book.id,
            label: (
              <Link to={`/books/${book.id}`} className={bookLink}>
                {book.title}
              </Link>
            ),
            sub: book.user.firstname,
            value: book.lendCount,
          }))}
        />
        <RankedList
          title="Top lenders"
          empty="No loans yet."
          rows={lending.topLenders.map((lender) => ({
            key: lender.id,
            label: lender.name,
            value: lender.loans,
          }))}
        />
      </div>
    </section>
  );
}

type AdminUser = Data["users"][number];

const sorts = {
  newest: {
    label: "Newest",
    compare: (a: AdminUser, b: AdminUser) => b.createdAt.localeCompare(a.createdAt),
  },
  active: {
    label: "Last active",
    compare: (a: AdminUser, b: AdminUser) => b.lastActive.localeCompare(a.lastActive),
  },
  books: {
    label: "Most books",
    compare: (a: AdminUser, b: AdminUser) => b.bookCount - a.bookCount,
  },
  name: {
    label: "Name",
    compare: (a: AdminUser, b: AdminUser) => a.name.localeCompare(b.name),
  },
};

// Every change asks first; your own account can't be changed here
function UserActions({ user, isYou }: { user: AdminUser; isYou: boolean }) {
  const fetcher = useFetcher<typeof action>({ key: `admin-${user.id}` });
  const busy = fetcher.state !== "idle";
  const error = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;

  if (isYou) {
    return (
      <p className={`text-sm ${mutedClass}`}>
        This is you, so there&apos;s nothing to change here.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <fetcher.Form
        method="post"
        onSubmit={(event) => {
          const message = user.isAdmin
            ? `Remove ${user.name}'s admin access?`
            : `Make ${user.name} an admin? They'll be able to see this page and change other accounts.`;
          if (!confirm(message)) event.preventDefault();
        }}
      >
        <input type="hidden" name="intent" value="setAdmin" />
        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="isAdmin" value={String(!user.isAdmin)} />
        <button type="submit" disabled={busy} className={outlineButton}>
          {user.isAdmin ? "Remove admin" : "Make admin"}
        </button>
      </fetcher.Form>
      <fetcher.Form
        method="post"
        onSubmit={(event) => {
          const books = `${user.bookCount} ${user.bookCount === 1 ? "book" : "books"}`;
          const message = `Delete ${user.name}'s account? Their ${books}, notes and friendships go with it. This can't be undone.`;
          if (!confirm(message)) event.preventDefault();
        }}
      >
        <input type="hidden" name="intent" value="deleteUser" />
        <input type="hidden" name="userId" value={user.id} />
        <button
          type="submit"
          disabled={busy}
          className={`${outlineButton} hover:text-red-700 hover:ring-red-300 dark:hover:text-red-400 dark:hover:ring-red-900`}
        >
          Delete account
        </button>
      </fetcher.Form>
      {error ? <p className="text-sm text-red-700 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

const userColumns = "sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4.5rem_6rem]";

function UserRow({ user, isYou }: { user: AdminUser; isYou: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-3 text-left text-sm ${userColumns}`}
      >
        <span className="min-w-0">
          <span className="font-medium text-stone-900 dark:text-stone-100">{user.name}</span>
          {user.isAdmin ? (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium text-stone-600 ring-1 ring-inset ring-stone-300 dark:text-stone-300 dark:ring-stone-700">
              Admin
            </span>
          ) : null}
          <span className={`block truncate ${mutedClass}`}>{user.email}</span>
        </span>
        <span className="hidden text-right tabular-nums sm:block">{user.bookCount}</span>
        <span className="hidden text-right tabular-nums sm:block">{user.friendCount}</span>
        <span className="hidden text-right tabular-nums sm:block">{user.borrowedCount}</span>
        <span className={`text-right ${mutedClass}`}>{ago(user.lastActive)}</span>
      </button>
      {open ? (
        <div className="space-y-3 pb-4 text-sm text-stone-800 dark:text-stone-200">
          <p className={mutedClass}>
            Joined{" "}
            {new Date(user.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
            <span className="sm:hidden">
              {" "}
              · {user.bookCount} books · {user.friendCount} friends · borrowed{" "}
              {user.borrowedCount}
            </span>
          </p>
          {user.bookTitles.length ? (
            <p>
              <span className={mutedClass}>Latest books: </span>
              {user.bookTitles.join(", ")}
              {user.bookCount > user.bookTitles.length ? "…" : ""}
            </p>
          ) : null}
          {user.friendNames.length ? (
            <p>
              <span className={mutedClass}>Friends: </span>
              {user.friendNames.join(", ")}
            </p>
          ) : null}
          <UserActions user={user} isYou={isYou} />
        </div>
      ) : null}
    </li>
  );
}

function People({ users, userId }: { users: Data["users"]; userId: string }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<keyof typeof sorts>("newest");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(
        (user) =>
          !q || user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q),
      )
      .sort(sorts[sort].compare);
  }, [users, query, sort]);

  const field =
    "rounded-md bg-transparent px-3 py-1.5 text-sm text-stone-900 ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:outline-none focus:ring-stone-500 dark:text-stone-100 dark:ring-stone-700";
  return (
    <section aria-labelledby="people">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="people" className={headingClass}>
          People <span className={`font-normal ${mutedClass}`}>{users.length}</span>
        </h2>
        <div className="flex w-full gap-2 sm:w-auto">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            aria-label="Search people"
            className={`${field} min-w-0 flex-1 sm:w-56`}
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as keyof typeof sorts)}
            aria-label="Sort people"
            className={`${field} dark:bg-stone-950`}
          >
            {Object.entries(sorts).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div
        className={`mt-4 hidden gap-x-4 border-b border-stone-200 pb-2 text-xs font-medium sm:grid dark:border-stone-800 ${userColumns} ${mutedClass}`}
      >
        <span>Name</span>
        <span className="text-right">Books</span>
        <span className="text-right">Friends</span>
        <span className="text-right">Borrowed</span>
        <span className="text-right">Last active</span>
      </div>
      {shown.length ? (
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {shown.map((user) => (
            <UserRow key={user.id} user={user} isYou={user.id === userId} />
          ))}
        </ul>
      ) : (
        <p className={`mt-4 text-sm ${mutedClass}`}>Nobody matches “{query}”.</p>
      )}
    </section>
  );
}

function DataQuality({ quality }: { quality: Data["quality"] }) {
  const fetcher = useFetcher<typeof action>({ key: "clear-demos" });
  const clearing = fetcher.state !== "idle";
  return (
    <section aria-labelledby="data-quality">
      <h2 id="data-quality" className={headingClass}>
        Data quality
      </h2>
      <dl className="mt-4 grid grid-cols-3 gap-6">
        <Stat label="No cover" value={quality.noCover} />
        <Stat label="No description" value={quality.noDescription} />
        <Stat label="No subjects" value={quality.noSubjects} />
      </dl>
      {quality.books.length ? (
        <ul className="mt-4 divide-y divide-stone-100 text-sm dark:divide-stone-800">
          {quality.books.map((book) => (
            <li key={book.id} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0 truncate">
                <Link
                  to={`/books/${book.id}`}
                  className={`font-medium text-stone-900 dark:text-stone-100 ${bookLink}`}
                >
                  {book.title}
                </Link>
                <span className={mutedClass}> · {book.owner}</span>
              </span>
              <span className={`whitespace-nowrap ${mutedClass}`}>
                No {book.missing.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-4 text-sm ${mutedClass}`}>
          Every book has a cover, description and subjects.
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={subheadingClass}>Demo sandboxes</h3>
          <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">
            {quality.sandboxes} in the database, {quality.expiredSandboxes} older than a day
          </p>
        </div>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="clearDemos" />
          <button
            type="submit"
            disabled={clearing || quality.expiredSandboxes === 0}
            className={outlineButton}
          >
            {clearing ? "Clearing…" : "Clear old sandboxes"}
          </button>
        </fetcher.Form>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { userId, health, lending, users, quality } = useLoaderData<typeof loader>();
  return (
    <Layout title="Admin Dashboard">
      <Health health={health} />
      <Lending lending={lending} />
      <People users={users} userId={userId} />
      <DataQuality quality={quality} />
    </Layout>
  );
}
