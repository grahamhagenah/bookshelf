import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  SerializeFrom,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";

import {
  BookIcon,
  DashboardIcon,
  GroupIcon,
  LentIcon,
  UserIcon,
} from "~/components/icons";
import Layout from "~/components / Layout/Layout";
import {
  getAdminUsers,
  getDataQuality,
  getFunnel,
  getHealth,
  getLending,
  setPlan,
} from "~/models/admin.server";
import { deleteExpiredDemoGroups } from "~/models/demo.server";
import { getFeedback, setFeedbackDone } from "~/models/feedback.server";
import { deleteUsers, getUserByEmail, isUserAdmin, updateUser } from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { validateEmail } from "~/utils";

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
  const [health, funnel, feedback, lending, users, quality] = await Promise.all([
    getHealth(),
    getFunnel(),
    getFeedback(),
    getLending(),
    getAdminUsers(),
    getDataQuality(),
  ]);
  return json({ userId, health, funnel, feedback, lending, users, quality });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "clearDemos") {
    await deleteExpiredDemoGroups();
    return json({ ok: true });
  }

  if (intent === "feedbackDone") {
    const id = form.get("feedbackId");
    if (typeof id !== "string") return json({ error: "No feedback given" }, { status: 400 });
    await setFeedbackDone(id, form.get("done") === "true");
    return json({ ok: true });
  }

  const targetId = form.get("userId");
  if (typeof targetId !== "string" || !targetId) {
    return json({ error: "No account given" }, { status: 400 });
  }

  if (intent === "updateUser") {
    const firstname = String(form.get("firstname") ?? "").trim();
    const surname = String(form.get("surname") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    if (!firstname || !surname) {
      return json({ error: "Both names are needed" }, { status: 400 });
    }
    if (!validateEmail(email)) {
      return json({ error: "That email doesn't look right" }, { status: 400 });
    }
    const existing = await getUserByEmail(email);
    if (existing && existing.id !== targetId) {
      return json({ error: `${email} belongs to another account` }, { status: 400 });
    }
    await updateUser(targetId, { firstname, surname, email });
    return json({ ok: true, saved: true });
  }

  if (intent === "setPlan") {
    await setPlan(targetId, form.get("plus") === "true");
    return json({ ok: true });
  }

  // Admins can't delete their own account from here
  if (targetId === userId) {
    return json({ error: "You can't delete your own account here" }, { status: 400 });
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

// One hue per kind of thing, so the eye can find people, books and loans
// across the page: the stat's icon tile and its chart share it
const tones = {
  sky: {
    tile: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
    bar: "bg-sky-600 group-hover:bg-sky-800 dark:bg-sky-400 dark:group-hover:bg-sky-200",
  },
  amber: {
    tile: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    bar: "bg-amber-500 group-hover:bg-amber-700 dark:bg-amber-400 dark:group-hover:bg-amber-200",
  },
  forest: {
    tile: "bg-forest-600/10 text-forest-700 dark:bg-forest-400/15 dark:text-forest-400",
    bar: "bg-forest-600 group-hover:bg-forest-700 dark:bg-forest-400 dark:group-hover:bg-forest-500",
  },
  violet: {
    tile: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    bar: "bg-violet-600 group-hover:bg-violet-800 dark:bg-violet-400 dark:group-hover:bg-violet-200",
  },
  stone: {
    tile: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
    bar: "bg-stone-400 group-hover:bg-stone-600 dark:bg-stone-500 dark:group-hover:bg-stone-300",
  },
};
type Tone = keyof typeof tones;

// Overdue loans and open feedback: something to look at
const warnText = "text-red-700 dark:text-red-400";

function Stat({
  label,
  value,
  note,
  noteClass = mutedClass,
  icon: Icon,
  tone = "stone",
}: {
  label: string;
  value: number;
  note?: string;
  noteClass?: string;
  icon?: (props: { size?: number }) => JSX.Element;
  tone?: Tone;
}) {
  return (
    // The tile is centred on the label and figure, close to their height
    <div className="flex items-center gap-3">
      {Icon ? (
        <span
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tones[tone].tile}`}
          aria-hidden
        >
          <Icon size={20} />
        </span>
      ) : null}
      <div>
        <dt className={`text-sm ${mutedClass}`}>{label}</dt>
        <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-50">
            {value.toLocaleString()}
          </span>
          {note ? <span className={`text-sm ${noteClass}`}>{note}</span> : null}
        </dd>
      </div>
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
  tone,
}: {
  tone: Tone;
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
              className={`w-full rounded-t-sm ${tones[tone].bar}`}
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
      {/* One card, so the five read as a set */}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/40 sm:grid-cols-3 sm:p-5 lg:grid-cols-5">
        <Stat
          label="People"
          value={health.users}
          note={`+${health.newUsers7} this week`}
          icon={UserIcon}
          tone="sky"
        />
        <Stat
          label="Books"
          value={health.books}
          note={`+${health.booksAdded7} this week`}
          icon={BookIcon}
          tone="amber"
        />
        <Stat
          label="On loan"
          value={health.onLoan}
          note={health.overdue ? `${health.overdue} overdue` : undefined}
          noteClass={warnText}
          icon={LentIcon}
          tone="forest"
        />
        <Stat label="Friendships" value={health.friendships} icon={GroupIcon} tone="violet" />
        <Stat label="Demo visits today" value={health.demosToday} icon={DashboardIcon} />
      </dl>
      <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-10">
        <DailyBars
          title="Sign-ups"
          total={health.newUsers30}
          days={health.signupsPerDay}
          noun={["sign-up", "sign-ups"]}
          tone="sky"
        />
        <DailyBars
          title="Loans started"
          total={health.loansStarted30}
          days={health.loansPerDay}
          noun={["loan", "loans"]}
          tone="forest"
        />
      </div>
    </section>
  );
}

// How far people get after signing up. Each bar is out of everyone who
// signed up, labelled with that share; the chip on the right is how many
// made it from the step before.
function Funnel({ funnel }: { funnel: Data["funnel"] }) {
  const [range, setRange] = useState<"last30" | "allTime">("allTime");
  const steps = funnel[range];
  const total = steps[0].count;
  const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
  return (
    <section aria-labelledby="funnel">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="funnel" className={headingClass}>
          Funnel
        </h2>
        <div className="flex gap-1.5" role="group" aria-label="Who to count">
          {(
            [
              ["allTime", "Everyone"],
              ["last30", "Joined in the last 30 days"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
              className={`rounded-full px-2.5 py-1 text-sm transition-colors ${
                range === value
                  ? "bg-forest-600/10 dark:bg-forest-400/15 text-forest-700 dark:text-forest-400 font-medium"
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {total === 0 ? (
        <p className={`mt-4 ${mutedClass}`}>Nobody signed up in this window.</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {steps.map((step, index) => {
            const share = percent(step.count, total);
            return (
              <li
                key={step.label}
                className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_4.5rem]"
              >
                <span className="col-span-2 font-medium text-stone-800 dark:text-stone-200 sm:col-span-1">
                  {step.label}
                </span>
                <span className="flex h-7 items-center rounded-md bg-forest-600/[0.07] dark:bg-forest-400/10">
                  {/* The figures ride inside a wide bar, just past the end of a short one */}
                  <span
                    className="flex h-full items-center justify-end rounded-md bg-forest-600 dark:bg-forest-400"
                    style={{ width: `${share}%` }}
                  >
                    {share >= 40 ? (
                      <span className="px-2 text-xs font-semibold tabular-nums text-white dark:text-stone-950">
                        {step.count.toLocaleString()}
                        {index === 0 ? null : <span className="font-normal opacity-80"> · {share}%</span>}
                      </span>
                    ) : null}
                  </span>
                  {share < 40 ? (
                    <span className="px-2 text-xs tabular-nums">
                      <span className="font-semibold text-stone-900 dark:text-stone-50">
                        {step.count.toLocaleString()}
                      </span>
                      {index === 0 ? null : <span className={mutedClass}> · {share}%</span>}
                    </span>
                  ) : null}
                </span>
                <span className="text-right">
                  {index === 0 ? null : (
                    <span
                      className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-700 dark:bg-stone-800 dark:text-stone-200"
                      title="Made it from the step above"
                    >
                      ↓ {percent(step.count, steps[index - 1].count)}%
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className={`mt-3 text-xs ${mutedClass}`}>
        Real accounts only. Each bar is a share of everyone who signed up; the ↓ figure is
        how many made it from the step above.
      </p>
    </section>
  );
}

// What people have sent from the feedback page, open ones first
function Feedback({ feedback }: { feedback: Data["feedback"] }) {
  const open = feedback.filter((item) => !item.done).length;
  return (
    <section aria-labelledby="feedback-heading" id="feedback">
      <h2 id="feedback-heading" className={headingClass}>
        Feedback
        {open ? (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            {open} open
          </span>
        ) : null}
      </h2>
      {feedback.length === 0 ? (
        <p className={`mt-4 ${mutedClass}`}>
          Nothing yet. It&apos;s linked from the footer and the account menu.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-stone-100 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-800">
          {feedback.map((item) => (
            <FeedbackItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedbackItem({ item }: { item: Data["feedback"][number] }) {
  const fetcher = useFetcher();
  const done = fetcher.formData ? fetcher.formData.get("done") === "true" : item.done;
  const who = item.user
    ? `${item.user.firstname} ${item.user.surname}${item.user.demoGroup ? " (demo)" : ""}`
    : "A visitor";
  const replyTo = item.user && !item.user.demoGroup ? item.user.email : item.email;
  return (
    <li className={`flex gap-4 px-4 py-3 ${done ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-pretty text-stone-800 dark:text-stone-200">{item.body}</p>
        <p className={`mt-1 text-xs ${mutedClass}`}>
          {who}
          {replyTo ? (
            <>
              {" · "}
              <a href={`mailto:${replyTo}`} className={bookLink}>
                {replyTo}
              </a>
            </>
          ) : null}
          {item.page ? <> · from {item.page}</> : null} · {ago(item.createdAt)}
        </p>
      </div>
      <fetcher.Form method="post" className="flex-shrink-0">
        <input type="hidden" name="intent" value="feedbackDone" />
        <input type="hidden" name="feedbackId" value={item.id} />
        <input type="hidden" name="done" value={done ? "false" : "true"} />
        <button type="submit" className={outlineButton}>
          {done ? "Reopen" : "Done"}
        </button>
      </fetcher.Form>
    </li>
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
                  <span className={`whitespace-nowrap font-medium tabular-nums ${warnText}`}>
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

const fieldLabel = `block text-xs font-medium ${mutedClass}`;
const field =
  "mt-1 w-full rounded-md bg-transparent px-3 py-1.5 text-sm text-stone-900 ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-forest-600 dark:text-stone-100 dark:ring-stone-700 dark:focus:ring-forest-400";
const saveButton =
  "rounded-md bg-forest-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-700 disabled:opacity-50 transition-colors";

// Name and email, right there to change. Delete takes two clicks: the
// first arms it and says what goes, the second deletes. Your own account
// can't be deleted from here.
function EditUser({ user, isYou }: { user: AdminUser; isYou: boolean }) {
  const fetcher = useFetcher<typeof action>({ key: `admin-${user.id}` });
  const busy = fetcher.state !== "idle";
  const deleting = busy && fetcher.formData?.get("intent") === "deleteUser";
  const error = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;
  const saved = fetcher.state === "idle" && fetcher.data && "saved" in fetcher.data;
  const [armed, setArmed] = useState(false);

  // Disarm on its own after a few seconds
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div className="space-y-2">
      {/* Both forms share one row: the edit form's fields sit straight in the
          grid, and Delete takes the last cell */}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.6fr_auto_auto] sm:items-end">
        <fetcher.Form method="post" className="contents">
          <input type="hidden" name="intent" value="updateUser" />
          <input type="hidden" name="userId" value={user.id} />
          <label className={fieldLabel}>
            First name
            <input name="firstname" defaultValue={user.firstname} required className={field} />
          </label>
          <label className={fieldLabel}>
            Surname
            <input name="surname" defaultValue={user.surname} required className={field} />
          </label>
          <label className={fieldLabel}>
            Email
            <input name="email" type="email" defaultValue={user.email} required className={field} />
          </label>
          <button type="submit" disabled={busy} className={saveButton}>
            {busy && !deleting ? "Saving…" : "Save"}
          </button>
        </fetcher.Form>
        {isYou ? null : (
          <fetcher.Form
            method="post"
            onSubmit={(event) => {
              if (!armed) {
                event.preventDefault();
                setArmed(true);
              }
            }}
          >
            <input type="hidden" name="intent" value="deleteUser" />
            <input type="hidden" name="userId" value={user.id} />
            <button
              type="submit"
              disabled={busy}
              onBlur={() => setArmed(false)}
              // Same width either way, so the fields beside it don't move
              className={`w-full whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-inset disabled:opacity-50 transition-colors sm:w-32 ${
                armed || deleting
                  ? "bg-red-600 text-white ring-red-600 hover:bg-red-700"
                  : "text-red-700 ring-red-200 hover:bg-red-50 dark:text-red-400 dark:ring-red-900 dark:hover:bg-red-950/40"
              }`}
            >
              {deleting ? "Deleting…" : armed ? "Click to confirm" : "Delete account"}
            </button>
          </fetcher.Form>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm" role="status">
        {error ? (
          <span className={warnText}>{error}</span>
        ) : armed ? (
          <span className={warnText}>
            Click again to delete {user.name} with their {user.bookCount}{" "}
            {user.bookCount === 1 ? "book" : "books"}, notes and friendships. This can&apos;t be
            undone.
          </span>
        ) : saved ? (
          <span className="text-forest-700 dark:text-forest-400">Saved</span>
        ) : isYou ? (
          <span className={mutedClass}>This is you, so it can&apos;t be deleted here.</span>
        ) : null}
      </p>
      <PlanSwitch user={user} />
      </div>
    </div>
  );
}

// Give someone Plus for free, or take back a gift
function PlanSwitch({ user }: { user: AdminUser }) {
  const fetcher = useFetcher<typeof action>({ key: `plan-${user.id}` });
  const plus = fetcher.formData ? fetcher.formData.get("plus") === "true" : user.plus;
  return (
    <fetcher.Form method="post" className="flex items-center gap-2 text-sm">
      <input type="hidden" name="intent" value="setPlan" />
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="plus" value={plus ? "false" : "true"} />
      <span className={mutedClass}>{plus ? "On Stacks Plus" : "Free plan"}</span>
      <button type="submit" className={outlineButton}>
        {plus ? "End Plus" : "Give Plus"}
      </button>
    </fetcher.Form>
  );
}

const userColumns = "sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4.5rem_6rem_4.5rem]";

function UserRow({ user, isYou }: { user: AdminUser; isYou: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div
        className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 py-3 text-sm ${userColumns}`}
      >
        <span className="min-w-0">
          <span className="font-medium text-stone-900 dark:text-stone-100">{user.name}</span>
          {user.isAdmin ? (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium bg-forest-600/10 text-forest-700 dark:bg-forest-400/15 dark:text-forest-400">
              Admin
            </span>
          ) : null}
          {user.plus ? (
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              Plus
            </span>
          ) : null}
          <span className={`block truncate ${mutedClass}`}>{user.email}</span>
        </span>
        <span className="hidden text-right tabular-nums sm:block">{user.bookCount}</span>
        <span className="hidden text-right tabular-nums sm:block">{user.friendCount}</span>
        <span className="hidden text-right tabular-nums sm:block">{user.borrowedCount}</span>
        <span className={`text-right ${mutedClass}`}>{ago(user.lastActive)}</span>
        {/* Fixed width, so Edit and Close don't nudge the row */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Close" : "Edit"} ${user.name}`}
          onClick={() => setOpen(!open)}
          className={`${outlineButton} w-16 justify-self-end text-center ${
            open ? "bg-stone-100 dark:bg-stone-800" : ""
          }`}
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>
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
          <EditUser user={user} isYou={isYou} />
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

  const control =
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
            className={`${control} min-w-0 flex-1 sm:w-56`}
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as keyof typeof sorts)}
            aria-label="Sort people"
            className={`${control} dark:bg-stone-950`}
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
        <span />
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
  const { userId, health, funnel, feedback, lending, users, quality } = useLoaderData<typeof loader>();
  return (
    <Layout title="Admin Dashboard">
      <Health health={health} />
      <Funnel funnel={funnel} />
      <Feedback feedback={feedback} />
      <Lending lending={lending} />
      <People users={users} userId={userId} />
      <DataQuality quality={quality} />
    </Layout>
  );
}
