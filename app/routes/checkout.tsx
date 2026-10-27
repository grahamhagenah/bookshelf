import { useEffect, useRef, useState } from "react";
import { data, Form, Link, useActionData, useLoaderData, useLocation, useNavigate, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import { CameraView, useBarcodeCamera } from "~/components/barcode-camera";
import BookCover from "~/components/book-cover";
import Layout from "~/components/layout";
import { primaryButton, quietButton, sectionHeading, textField } from "~/components/ui";
import { dueText } from "~/due";
import { LOAN_WEEKS, loanWeeks } from "~/models/book.server";
import { checkIn, checkOut, findOnShelf, loansOut } from "~/models/checkout.server";
import { addNames, findOrAddName, NAME_LIST_MAX, nameList, readNames, removeName } from "~/models/name-list.server";
import { pageUrl } from "~/page-url";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import type { LoaderData } from "~/utils";

// The check-out desk: scan a book and tap a name to lend it, scan it again
// when it comes back. Made for a classroom, where the borrowers are names
// on a list rather than friends on Stacks.

export const meta: MetaFunction = () => seo({ title: "Check-out desk", noindex: true });

export const handle = {
  breadcrumb: () => <span>Check-out desk</span>,
};

// A class's loans run shorter than a friend's
const DESK_WEEKS = 2;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const query = pageUrl(request).searchParams.get("q")?.trim() ?? "";
  const [names, out, found] = await Promise.all([
    nameList(userId),
    loansOut(userId),
    query ? findOnShelf(userId, query) : null,
  ]);
  return data({ query, names, out, found, weekChoices: LOAN_WEEKS });
};

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;
const fullName = (person: { firstname: string; surname: string }) =>
  `${person.firstname} ${person.surname}`.trim();

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const intent = form.get("intent");
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const weeks = loanWeeks(form.get("weeks"));

  if (intent === "lend") {
    const bookIds = form.getAll("bookId").filter((id): id is string => typeof id === "string");
    // Someone on the list, or a name typed in, who goes on it
    const personId = text("personId") || (await findOrAddName(userId, text("name")))?.id;
    if (!personId) return data({ error: "Add their name." }, { status: 400 });
    const lent = await checkOut(userId, { bookIds, personId, weeks });
    if (!lent) return data({ error: "That book isn't on your shelf to lend now." }, { status: 400 });
    return data({
      done: `${lent.title} is out to ${fullName(lent.person)}, ${dueText(lent.dueDate ?? new Date())}.`,
      weeks,
    });
  }

  if (intent === "return") {
    const back = await checkIn(userId, text("bookId"));
    if (!back) return data({ error: "That book isn't out." }, { status: 400 });
    return data({
      done: `${back.title} is back${back.person ? ` from ${fullName(back.person)}` : ""}.`,
      weeks,
    });
  }

  if (intent === "addNames") {
    const names = readNames(text("names"));
    if (!names.length) return data({ error: "Add a name or two.", about: "names" }, { status: 400 });
    const result = await addNames(userId, names);
    if (result.full) {
      return data({ error: `A list holds up to ${NAME_LIST_MAX} names.`, about: "names" }, { status: 400 });
    }
    return data({
      done: result.added ? `${plural(result.added, "name")} added.` : "They're on the list already.",
      weeks,
      about: "names",
    });
  }

  if (intent === "removeName") {
    const removed = await removeName(userId, text("personId"));
    if (!removed.ok) {
      return data(
        {
          error: `${text("name")} still has ${removed.out.join(" and ")}. Take it back first, then remove them.`,
          about: "names",
        },
        { status: 400 },
      );
    }
    return data({ done: `${text("name")} is off your list, with their loans.`, weeks, about: "names" });
  }

  throw new Response("Unknown intent", { status: 400 });
};

type Copy = LoaderData<typeof loader>["out"][number];
type Person = LoaderData<typeof loader>["names"][number];

const muted = "text-stone-500 dark:text-stone-400";
const chip =
  "rounded-full border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm text-stone-800 dark:text-stone-100 hover:border-forest-600 hover:bg-forest-600/[0.06] dark:hover:border-forest-400 dark:hover:bg-forest-400/10 transition-colors";

// Copies of one book together: a class set is one book with many copies
function byBook(copies: Copy[]) {
  const groups = new Map<string, Copy[]>();
  for (const copy of copies) {
    const key = copy.openLibraryKey ?? copy.isbn ?? copy.id;
    groups.set(key, [...(groups.get(key) ?? []), copy]);
  }
  return [...groups.values()];
}

function Late({ dueDate }: { dueDate: string | Date | null }) {
  if (!dueDate) return null;
  const text = dueText(dueDate);
  return (
    <span className={/late|yesterday/.test(text) ? "font-medium text-red-700 dark:text-red-400" : undefined}>
      {text}
    </span>
  );
}

function TakeBack({ copy }: { copy: Copy }) {
  return (
    <Form method="post" action="/checkout" preventScrollReset>
      <input type="hidden" name="intent" value="return" />
      <input type="hidden" name="bookId" value={copy.id} />
      <button type="submit" className={`${quietButton("md")} whitespace-nowrap`}>
        Take it back
      </button>
    </Form>
  );
}

// A book found by the scan: who to lend it to, or who has it
function Found({ copies, names, weeks }: { copies: Copy[]; names: Person[]; weeks: number }) {
  const [first] = copies;
  const here = copies.filter((copy) => !copy.borrower);
  const out = copies.filter((copy) => copy.borrower);
  return (
    <li className="flex gap-4 py-5">
      <BookCover cover={first.cover} title={first.title} className="w-14 h-21 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100">
          <Link to={`/books/${first.id}`} className="hover:underline underline-offset-2">
            {first.title}
          </Link>
        </h3>
        <p className={`text-sm ${muted}`}>
          {first.author}
          {copies.length > 1 ? ` · ${here.length} of ${copies.length} copies here` : ""}
        </p>

        {here.length ? (
          <div className="mt-3">
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Who&apos;s taking it?{" "}
              <span className={`font-normal ${muted}`}>For {plural(weeks, "week")}</span>
            </p>
            {names.length ? (
              <Form method="post" action="/checkout" preventScrollReset className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="intent" value="lend" />
                <input type="hidden" name="weeks" value={weeks} />
                {here.map((copy) => (
                  <input key={copy.id} type="hidden" name="bookId" value={copy.id} />
                ))}
                {names.map((person) => (
                  <button key={person.id} type="submit" name="personId" value={person.id} className={chip}>
                    {fullName(person)}
                  </button>
                ))}
              </Form>
            ) : null}
            <Form method="post" action="/checkout" preventScrollReset className="mt-3 flex max-w-sm gap-2">
              <input type="hidden" name="intent" value="lend" />
              <input type="hidden" name="weeks" value={weeks} />
              {here.map((copy) => (
                <input key={copy.id} type="hidden" name="bookId" value={copy.id} />
              ))}
              <input
                name="name"
                required
                aria-label="Their name"
                placeholder={names.length ? "Someone else" : "Their name"}
                className={`${textField} py-1.5 text-sm`}
              />
              <button type="submit" className={`${primaryButton("md")} whitespace-nowrap`}>
                Lend it
              </button>
            </Form>
          </div>
        ) : null}

        {out.length ? (
          <ul className="mt-3 space-y-2">
            {out.map((copy) => (
              <li key={copy.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  With <strong className="font-semibold">{copy.borrower ? fullName(copy.borrower) : ""}</strong>,{" "}
                  <Late dueDate={copy.dueDate} />
                </p>
                <TakeBack copy={copy} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export default function Checkout() {
  const { query, names, out, found, weekChoices } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false);
  const [weeks, setWeeks] = useState(DESK_WEEKS);
  const busy = navigation.state !== "idle";

  // Ready for the next book: a barcode reader plugged into a computer types
  // into whatever has focus, so the box has it, with what's in it selected
  // for the next scan to replace. Not on a phone, where focus brings up the
  // keyboard over the camera.
  useEffect(() => {
    if (!camera && window.matchMedia("(pointer: fine)").matches) inputRef.current?.select();
  }, [location.key, camera]);

  const groups = found ? byBook(found) : [];
  const outByPerson = new Map<string, number>();
  for (const copy of out) {
    if (copy.borrower) outByPerson.set(copy.borrower.id, (outByPerson.get(copy.borrower.id) ?? 0) + 1);
  }

  return (
    <Layout title="Check-out desk">
      <section>
        <h2 className={sectionHeading}>Check-out desk</h2>
        <p className={`mt-1 max-w-xl text-pretty ${muted}`}>
          Scan a book and tap a name to lend it. Scan it again when it comes back. Names need no
          email and get nothing from Stacks; reminders come to you.
        </p>

        {camera ? (
          <div className="mt-4 max-w-md rounded-lg bg-stone-950 p-3">
            <Camera onIsbn={(isbn) => navigate(`/checkout?q=${isbn}`, { replace: true, preventScrollReset: true })} />
          </div>
        ) : null}

        <Form method="get" action="/checkout" className="mt-4 flex max-w-xl flex-wrap gap-2">
          <input
            ref={inputRef}
            key={query}
            name="q"
            defaultValue={query}
            aria-label="ISBN or title"
            placeholder="Scan or type an ISBN or title"
            autoComplete="off"
            className={`${textField} min-w-0 flex-1 basis-56`}
          />
          <button type="submit" className={primaryButton("lg")}>
            Find
          </button>
          <button
            type="button"
            onClick={() => setCamera(!camera)}
            aria-pressed={camera}
            className={quietButton("lg")}
          >
            {camera ? "Camera off" : "Use the camera"}
          </button>
        </Form>
        <label className={`mt-3 flex items-center gap-2 text-sm ${muted}`}>
          Lend for
          <select
            value={weeks}
            onChange={(event) => setWeeks(Number(event.target.value))}
            className="rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-1 text-sm text-stone-800 dark:text-stone-100"
          >
            {weekChoices.map((choice) => (
              <option key={choice} value={choice}>
                {plural(choice, "week")}
              </option>
            ))}
          </select>
        </label>

        {result && "done" in result && result.done && !query && !("about" in result) ? (
          <p role="status" className="mt-4 rounded-lg bg-forest-600/[0.08] dark:bg-forest-400/10 px-4 py-3 text-sm font-medium text-forest-800 dark:text-forest-300">
            {result.done}
          </p>
        ) : null}
        {result && "error" in result && !("about" in result) ? (
          <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
            {result.error}
          </p>
        ) : null}

        {query ? (
          groups.length ? (
            <ul className={`mt-2 divide-y divide-stone-100 dark:divide-stone-800 ${busy ? "opacity-60" : ""}`}>
              {groups.map((copies) => (
                <Found key={copies[0].id} copies={copies} names={names} weeks={weeks} />
              ))}
            </ul>
          ) : (
            <p className={`mt-4 text-sm ${muted}`}>
              Nothing on your shelf matches &ldquo;{query}&rdquo;.{" "}
              <Link
                to={`/search?q=${encodeURIComponent(query)}`}
                className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2"
              >
                Add it to your shelf
              </Link>
            </p>
          )
        ) : null}
      </section>

      <section>
        <h2 className={sectionHeading}>
          Out now <span className={`font-normal ${muted}`}>{out.length}</span>
        </h2>
        {out.length ? (
          <ul className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
            {out.map((copy) => (
              <li key={copy.id} className="flex items-center gap-3 py-3">
                <BookCover cover={copy.cover} title={copy.title} className="w-8 h-12 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                    <Link to={`/books/${copy.id}`} className="hover:underline underline-offset-2">
                      {copy.title}
                    </Link>
                  </p>
                  <p className={`truncate text-sm ${muted}`}>
                    {copy.borrower ? fullName(copy.borrower) : ""} · <Late dueDate={copy.dueDate} />
                  </p>
                </div>
                <TakeBack copy={copy} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={`mt-1 text-sm ${muted}`}>Nothing&apos;s out. Books you lend show here until they&apos;re back.</p>
        )}
      </section>

      <section>
        <h2 className={sectionHeading}>
          Names <span className={`font-normal ${muted}`}>{names.length || ""}</span>
        </h2>
        <p className={`mt-1 max-w-xl text-pretty text-sm ${muted}`}>
          {names.length
            ? "Tap one to lend them a book you've scanned. Removing a name deletes it and its loans from your history."
            : "Put your class on the list, and each one is a tap away when you scan a book. Anyone you lend to by name goes on it too."}
        </p>
        {result && "about" in result ? (
          <p
            role={"error" in result ? "alert" : "status"}
            className={`mt-3 text-sm ${"error" in result ? "text-red-700 dark:text-red-400" : "font-medium text-forest-800 dark:text-forest-300"}`}
          >
            {"error" in result ? result.error : result.done}
          </p>
        ) : null}
        {names.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {names.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-1 rounded-full bg-stone-100 dark:bg-stone-800 py-1 pl-3 pr-1 text-sm text-stone-800 dark:text-stone-100"
              >
                {fullName(person)}
                {outByPerson.get(person.id) ? (
                  <span className={`ml-1 text-xs ${muted}`}>{outByPerson.get(person.id)} out</span>
                ) : null}
                <Form
                  method="post"
                  action="/checkout"
                  preventScrollReset
                  // For good, with their loan history, so it's asked first
                  onSubmit={(event) => {
                    if (!window.confirm(`Remove ${fullName(person)} and their loans from your history?`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="intent" value="removeName" />
                  <input type="hidden" name="personId" value={person.id} />
                  <input type="hidden" name="name" value={fullName(person)} />
                  <button
                    type="submit"
                    aria-label={`Remove ${fullName(person)}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-700 dark:hover:bg-stone-700 dark:hover:text-stone-200 transition-colors"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </Form>
              </li>
            ))}
          </ul>
        ) : null}
        <Form method="post" action="/checkout" preventScrollReset className="mt-4 max-w-md">
          <input type="hidden" name="intent" value="addNames" />
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300" htmlFor="names">
            Add names
          </label>
          <textarea
            id="names"
            name="names"
            rows={names.length ? 2 : 5}
            placeholder={
              names.length ? "One a line, or separated by commas" : "One a line, or separated by commas\nSam Rivera\nAva Chen"
            }
            className={`mt-1 ${textField} text-sm`}
          />
          <button type="submit" className={`mt-2 ${quietButton("md")}`}>
            Add to the list
          </button>
        </Form>
      </section>
    </Layout>
  );
}

// Mounted only while it's wanted, so the camera's light goes off with it
function Camera({ onIsbn }: { onIsbn: (isbn: string) => void }) {
  const camera = useBarcodeCamera(onIsbn);
  return (
    <div className="text-stone-100">
      <CameraView camera={camera} />
      {camera.torch ? (
        <button
          type="button"
          onClick={camera.toggleTorch}
          aria-pressed={camera.torch.on}
          className="mt-2 rounded-md px-3 py-1.5 text-sm ring-1 ring-inset ring-stone-600 hover:bg-stone-800 transition-colors"
        >
          Light
        </button>
      ) : null}
    </div>
  );
}
