// @vitest-environment node
import { prisma } from "~/db.server";

import { makeBook, makeUser } from "../test/db";

import { createGroup, getMyGroups, joinGroup } from "./models/group.server";
import { createFriendship } from "./models/user.server";
import { loadPooledShelf } from "./pooled-shelf.server";

test("Friends' Books tab narrows to one group, or one person, from the address", async () => {
  const me = await makeUser("Me");
  const clubber = await makeUser("Clubber");
  const neighbor = await makeUser("Neighbor");
  await createFriendship(me.id, neighbor.id);
  const group = await createGroup(me.id, "Club");
  const { inviteToken } = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
  await joinGroup(clubber.id, inviteToken);
  await makeBook(clubber.id, "Club pick");
  await makeBook(neighbor.id, "Next door");

  const openIds = [clubber.id, neighbor.id];
  const lenders = [clubber, neighbor];
  const groups = await getMyGroups(me.id);
  const load = (query: string) =>
    loadPooledShelf(new Request(`http://stacks.test/friends/books${query}`), me.id, openIds, { lenders, groups });
  const titles = async (query: string) => (await load(query)).results.works.map((work) => work.title).sort();

  expect(await titles("")).toEqual(["Club pick", "Next door"]);
  expect(await titles(`?who=g:${group.id}`)).toEqual(["Club pick"]);
  expect((await load(`?who=g:${group.id}`)).group).toMatchObject({ name: "Club" });
  expect(await titles(`?who=${neighbor.id}`)).toEqual(["Next door"]);
  // A group you're not in, or nobody you know, narrows to nothing in particular
  expect(await titles("?who=g:somebody-elses")).toEqual(["Club pick", "Next door"]);
  expect((await load("")).groups.map((g) => g.name)).toEqual(["Club"]);
});

test("a book from your want-to-read list shows once, on top, until you search", async () => {
  const me = await makeUser("Me");
  const friend = await makeUser("Friend");
  await createFriendship(me.id, friend.id);
  await makeBook(friend.id, "Wanted one");
  await makeBook(friend.id, "Another");
  await prisma.wantToRead.create({ data: { userId: me.id, title: "Wanted one", author: "Someone", cover: "" } });

  const load = (query: string) =>
    loadPooledShelf(new Request(`http://stacks.test/friends/books${query}`), me.id, [friend.id], {
      lenders: [friend],
    });
  const browsing = await load("");
  expect(browsing.wanted.map((work) => work.title)).toEqual(["Wanted one"]);
  expect(browsing.results.works.map((work) => work.title)).toEqual(["Another"]);
  // Still counted among all of them
  expect(browsing.results.counts.all).toBe(2);

  const searching = await load("?q=wanted");
  expect(searching.wanted).toEqual([]);
  expect(searching.results.works.map((work) => work.title)).toEqual(["Wanted one"]);
});
