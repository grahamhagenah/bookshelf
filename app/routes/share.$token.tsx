import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import Library from "~/components/library";
import { getPublicBookListItems } from "~/models/book.server";
import { canInteract, respondAsDemoPersona } from "~/models/demo.server";
import { shelfIds } from "~/models/household.server";
import type { FriendStatus } from "~/models/user.server";
import {
  createNotification,
  getFriendStatus,
  getUserById,
  getUserByShareToken,
} from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { seo } from "~/seo";
import { getUserId, requireUserId } from "~/session.server";

// What iMessage, Slack and friends show when the link is pasted
export const meta: MetaFunction<typeof loader> = ({ data, params }) =>
  seo({
    title: data?.ownerName ? `${data.ownerName}'s bookshelf` : "Bookshelf",
    description: data ? shelfSummary(data.ownerName, data.bookCount, data.sampleTitles) : undefined,
    path: `/share/${params.token}`,
    image: data ? `${data.origin}/share/${params.token}/preview.png` : undefined,
    noindex: true,
  });

// "18 books on Jordan Avery's shelf, including Dune, Piranesi and Circe."
function shelfSummary(name: string, count: number, titles: string[]) {
  const books = `${count} ${count === 1 ? "book" : "books"} on ${name}'s shelf`;
  if (titles.length === 0) return `${books}. Browse them on Stacks.`;
  const list =
    titles.length === 1
      ? titles[0]
      : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
  return `${books}, including ${list}.`;
}

export const handle = {
  breadcrumb: (data: { ownerName?: string } | undefined) => (
    <span>{data?.ownerName ? `${data.ownerName}'s library` : "Library"}</span>
  ),
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.token, "token not found");

  const user = await getUserByShareToken(params.token);

  if (!user) {
    throw new Response("Not Found", { status: 404 });
  }

  const viewerId = await getUserId(request);
  const [bookListItems, friendStatus] = await Promise.all([
    getPublicBookListItems(await shelfIds(user.id)),
    // Demo accounts and real ones can't befriend each other, so a demo
    // visitor sees the shelf without an invite
    viewerId && (await canInteract(viewerId, user.id))
      ? getFriendStatus(viewerId, user.id)
      : null,
  ]);

  return json({
    ownerId: user.id,
    ownerFirstname: user.firstname,
    ownerName: `${user.firstname} ${user.surname}`,
    signedIn: Boolean(viewerId),
    friendStatus,
    bookListItems,
    bookCount: bookListItems.length,
    sampleTitles: bookListItems.slice(0, 3).map((book) => book.title),
    shareToken: params.token,
    // Link previews need absolute URLs
    origin: publicOrigin(request),
  });
};

// A signed-in visitor asks the owner to be friends
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const viewerId = await requireUserId(request);
  const owner = params.token ? await getUserByShareToken(params.token) : null;
  if (!owner || !(await canInteract(viewerId, owner.id))) {
    throw new Response("Not Found", { status: 404 });
  }
  // Only ask once
  if ((await getFriendStatus(viewerId, owner.id)) !== "none") {
    return json({ ok: true });
  }

  const viewer = await getUserById(viewerId);
  if (!viewer) throw new Response("Not Found", { status: 404 });
  const friendRequest = await createNotification(
    viewerId,
    owner.id,
    `${viewer.firstname} ${viewer.surname}`,
  );
  await respondAsDemoPersona(friendRequest.id);
  return json({ ok: true });
};

const primaryButton =
  "inline-flex items-center justify-center rounded-md bg-forest-600 dark:bg-forest-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-700 dark:hover:bg-forest-400 transition-colors";
const secondaryButton =
  "inline-flex items-center justify-center rounded-md border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";

// The line above a shared shelf that turns a visit into a friendship:
// join (or sign in) and ask to be friends, so the books can be borrowed
function Invite({
  token,
  ownerId,
  ownerFirstname,
  ownerName,
  signedIn,
  friendStatus,
}: {
  token: string;
  ownerId: string;
  ownerFirstname: string;
  ownerName: string;
  signedIn: boolean;
  friendStatus: FriendStatus | null;
}) {
  const fetcher = useFetcher();
  const here = `/share/${token}`;
  // Show the request as sent straight away
  const status =
    fetcher.state !== "idle" && friendStatus === "none" ? "requested" : friendStatus;

  let text: React.ReactNode;
  let actions: React.ReactNode = null;

  if (!signedIn) {
    text = (
      <>
        <strong className="font-semibold text-stone-900 dark:text-stone-100">
          {ownerName}
        </strong>{" "}
        shares their bookshelf on Stacks. Join free to borrow their books.
      </>
    );
    actions = (
      <>
        <Link
          to={`/join?${new URLSearchParams({ invite: token, redirectTo: here })}`}
          className={primaryButton}
        >
          Join Stacks
        </Link>
        <Link
          // Carries the invite in case they switch to signing up
          to={`/login?${new URLSearchParams({ invite: token, redirectTo: here })}`}
          className={secondaryButton}
        >
          Sign in
        </Link>
      </>
    );
  } else if (status === "none") {
    text = <>Add {ownerName} as a friend to borrow their books.</>;
    actions = (
      <fetcher.Form method="post">
        <button type="submit" className={primaryButton}>
          Add friend
        </button>
      </fetcher.Form>
    );
  } else if (status === "requested") {
    text = (
      <>
        Friend request sent. You can borrow {ownerFirstname}&apos;s books once
        they accept.
      </>
    );
  } else if (status === "invited") {
    text = <>{ownerName} has asked to be your friend.</>;
    actions = (
      <Link to="/notifications" className={secondaryButton}>
        See request
      </Link>
    );
  } else if (status === "friends") {
    text = <>You and {ownerFirstname} are friends.</>;
    actions = (
      <Link to={`/friend/${ownerId}`} className={secondaryButton}>
        Borrow from their shelf
      </Link>
    );
  } else if (status === "self") {
    text = <>This is your shelf as others see it from your share link.</>;
    actions = (
      <Link to="/account" className={secondaryButton}>
        Manage link
      </Link>
    );
  } else {
    // A demo visitor on a real person's shelf
    return null;
  }

  return (
    <div className="px-4 md:px-8 pt-6 md:pt-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-stone-200 dark:border-stone-800 pb-5 text-sm text-stone-600 dark:text-stone-300">
        <p className="min-w-0 flex-1">{text}</p>
        {actions ? (
          <div className="flex flex-shrink-0 gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function PublicSharePage() {
  const data = useLoaderData<typeof loader>();
  const token = data.shareToken;

  return (
    <>
      <Invite
        token={token}
        ownerId={data.ownerId}
        ownerFirstname={data.ownerFirstname}
        ownerName={data.ownerName}
        signedIn={data.signedIn}
        friendStatus={data.friendStatus}
      />
      <Library bookListItems={data.bookListItems} ownerName={data.ownerName} />
    </>
  );
}
