
import { data } from "react-router";

import { prisma } from "~/db.server";
import { isNotLending } from "~/lending";
import { getPublicBookListItems } from "~/models/book.server";
import { canInteract, respondAsDemoPersona } from "~/models/demo.server";
import { shelfIds } from "~/models/household.server";
import { createNotification, getFriendStatus, getUserById } from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { getShelfProfile } from "~/profile.server";
import { getUserId, requireUserId } from "~/session.server";

// A shared shelf, as it's shown at /share/<token> and /@handle: the books,
// the owner's profile, and where the visitor stands with them

export async function loadSharedShelf(request: Request, owner: { id: string; shareToken: string }) {
  const user = await getUserById(owner.id);
  if (!user) throw new Response("Not Found", { status: 404 });

  const viewerId = await getUserId(request);
  const [books, friendStatus, profile] = await Promise.all([
    getPublicBookListItems(await shelfIds(user.id)),
    // Demo accounts and real ones can't befriend each other, so a demo
    // visitor sees the shelf without an invite
    viewerId && (await canInteract(viewerId, user.id)) ? getFriendStatus(viewerId, user.id) : null,
    getShelfProfile(user.id),
  ]);
  const bookListItems =
    friendStatus === "friends" ? await withAvailability(books) : books;

  return data({
    ownerId: user.id,
    ownerFirstname: user.firstname,
    ownerName: `${user.firstname} ${user.surname}`,
    ownerSurname: user.surname,
    ownerIcon: user.profileEmoji,
    profile,
    signedIn: Boolean(viewerId),
    friendStatus,
    bookListItems,
    bookCount: bookListItems.length,
    sampleTitles: bookListItems.slice(0, 3).map((book) => book.title),
    shareToken: owner.shareToken,
    // Link previews need absolute URLs
    origin: publicOrigin(request),
  });
}

// For a friend looking, whether each book can be borrowed now: out on
// loan, or kept back for a while. Only that, not who has it. Anyone else
// sees the shelf without it.
async function withAvailability<T extends { id: string }>(books: T[]) {
  const loans = await prisma.book.findMany({
    where: { id: { in: books.map((book) => book.id) } },
    select: { id: true, borrowerId: true, notLendingUntil: true },
  });
  const byId = new Map(loans.map((loan) => [loan.id, loan]));
  return books.map((book) => {
    const loan = byId.get(book.id);
    return {
      ...book,
      isLending: Boolean(loan?.borrowerId),
      notLending: isNotLending(loan?.notLendingUntil),
    };
  });
}

// A signed-in visitor asks the owner to be friends
export async function askToBeFriends(request: Request, ownerId: string) {
  const viewerId = await requireUserId(request);
  if (!(await canInteract(viewerId, ownerId))) {
    throw new Response("Not Found", { status: 404 });
  }
  // Only ask once
  if ((await getFriendStatus(viewerId, ownerId)) !== "none") {
    return data({ ok: true });
  }

  const viewer = await getUserById(viewerId);
  if (!viewer) throw new Response("Not Found", { status: 404 });
  const friendRequest = await createNotification(viewerId, ownerId, `${viewer.firstname} ${viewer.surname}`);
  await respondAsDemoPersona(friendRequest.id);
  return data({ ok: true });
}
