import type { User } from "@prisma/client";

import { prisma } from "~/db.server";
import { lendBook } from "~/models/book.server";
import {
  createBookApprovedNotification,
  createFriendship,
  markNotificationAsRead,
} from "~/models/user.server";
import { DEMO_EMAIL_DOMAIN } from "~/utils";

// Every demo visitor gets a private sandbox: their own account plus a handful
// of made-up friends, all tagged with the same demoGroup. Sandboxes are
// deleted after DEMO_TTL_HOURS, or when the visitor resets or leaves.
const DEMO_TTL_HOURS = 24;

interface DemoBook {
  title: string;
  author: string;
  isbn: string;
  datePublished: string;
  pageCount: number;
  publisher: string;
  subjects: string;
  body: string;
}

function cover(isbn: string) {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
}

const day = 24 * 60 * 60 * 1000;
const hour = 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms);
const fromNow = (ms: number) => new Date(Date.now() + ms);

const VISITOR = {
  key: "you",
  firstname: "Jordan",
  surname: "Avery",
  profileEmoji: null,
};

const PERSONAS = {
  maya: { firstname: "Maya", surname: "Chen", profileEmoji: "leaf" },
  sam: { firstname: "Sam", surname: "Okafor", profileEmoji: "mountain" },
  priya: { firstname: "Priya", surname: "Patel", profileEmoji: "book" },
  // Theo has sent the visitor a friend request; Lena shows up as a suggestion
  theo: { firstname: "Theo", surname: "Martin", profileEmoji: "wave" },
  lena: { firstname: "Lena", surname: "Fischer", profileEmoji: null },
} as const;

type PersonaKey = keyof typeof PERSONAS;
type OwnerKey = PersonaKey | "you";

const LIBRARIES: Record<OwnerKey, DemoBook[]> = {
  you: [
    {
      title: "Project Hail Mary",
      author: "Andy Weir",
      isbn: "9780593135204",
      datePublished: "2021",
      pageCount: 476,
      publisher: "Ballantine Books",
      subjects: "Science fiction, Space, Survival",
      body: "A lone astronaut wakes up on a ship far from home with no memory of how he got there, and slowly works out that the fate of Earth depends on him.",
    },
    {
      title: "Piranesi",
      author: "Susanna Clarke",
      isbn: "9781635575637",
      datePublished: "2020",
      pageCount: 272,
      publisher: "Bloomsbury",
      subjects: "Fantasy, Mystery, Labyrinths",
      body: "Piranesi lives in the House, an endless maze of halls and statues lapped by an inland sea, and keeps a careful journal of everything he finds there.",
    },
    {
      title: "Dune",
      author: "Frank Herbert",
      isbn: "9780441172719",
      datePublished: "1965",
      pageCount: 658,
      publisher: "Ace",
      subjects: "Science fiction, Politics, Ecology",
      body: "On the desert planet Arrakis, the only source of the most valuable substance in the universe, a young heir is caught up in a war for control of the spice.",
    },
    {
      title: "Circe",
      author: "Madeline Miller",
      isbn: "9780316556347",
      datePublished: "2018",
      pageCount: 393,
      publisher: "Little, Brown and Company",
      subjects: "Greek mythology, Fantasy, Witches",
      body: "Banished to an island by the gods, the daughter of Helios hones her craft in witchcraft and crosses paths with some of mythology's most famous figures.",
    },
    {
      title: "The Remains of the Day",
      author: "Kazuo Ishiguro",
      isbn: "9780679731726",
      datePublished: "1989",
      pageCount: 245,
      publisher: "Vintage",
      subjects: "Literary fiction, England, Memory",
      body: "An aging English butler takes a motoring trip across the countryside and looks back on decades of service and the choices he made along the way.",
    },
    {
      title: "Station Eleven",
      author: "Emily St. John Mandel",
      isbn: "9780804172448",
      datePublished: "2014",
      pageCount: 333,
      publisher: "Vintage",
      subjects: "Post-apocalyptic fiction, Theater, Survival",
      body: "Years after a pandemic collapses civilization, a travelling troupe of actors and musicians performs Shakespeare for the scattered settlements of the Great Lakes.",
    },
    {
      title: "Braiding Sweetgrass",
      author: "Robin Wall Kimmerer",
      isbn: "9781571313560",
      datePublished: "2013",
      pageCount: 391,
      publisher: "Milkweed Editions",
      subjects: "Botany, Nature, Indigenous knowledge",
      body: "A botanist and member of the Citizen Potawatomi Nation weaves together science, story and tradition to show what plants have to teach us.",
    },
    {
      title: "A Gentleman in Moscow",
      author: "Amor Towles",
      isbn: "9780143110439",
      datePublished: "2016",
      pageCount: 462,
      publisher: "Penguin Books",
      subjects: "Historical fiction, Russia, Hotels",
      body: "Sentenced to house arrest in a grand hotel across from the Kremlin, a count builds a rich life within its walls as decades of history pass outside.",
    },
    {
      title: "The Left Hand of Darkness",
      author: "Ursula K. Le Guin",
      isbn: "9780441478125",
      datePublished: "1969",
      pageCount: 304,
      publisher: "Ace",
      subjects: "Science fiction, Gender, Diplomacy",
      body: "An envoy is sent to the icebound world of Gethen, whose people have no fixed sex, to persuade them to join an interplanetary alliance.",
    },
    {
      title: "Pachinko",
      author: "Min Jin Lee",
      isbn: "9781455563920",
      datePublished: "2017",
      pageCount: 490,
      publisher: "Grand Central Publishing",
      subjects: "Historical fiction, Korea, Japan, Family",
      body: "Four generations of a Korean family make a life in Japan over the course of the twentieth century, held together by love and endurance.",
    },
    {
      title: "Thinking, Fast and Slow",
      author: "Daniel Kahneman",
      isbn: "9780374533557",
      datePublished: "2011",
      pageCount: 499,
      publisher: "Farrar, Straus and Giroux",
      subjects: "Psychology, Decision making, Behavioral economics",
      body: "A tour of the two systems that drive the way we think, one fast and intuitive, the other slow and deliberate, and the biases each one brings.",
    },
    {
      title: "The Hobbit",
      author: "J.R.R. Tolkien",
      isbn: "9780547928227",
      datePublished: "1937",
      pageCount: 300,
      publisher: "Houghton Mifflin Harcourt",
      subjects: "Fantasy, Adventure, Dragons",
      body: "Bilbo Baggins is swept out of his comfortable hobbit-hole on a quest with a wizard and thirteen dwarves to reclaim a treasure guarded by a dragon.",
    },
    {
      title: "Klara and the Sun",
      author: "Kazuo Ishiguro",
      isbn: "9780593318171",
      datePublished: "2021",
      pageCount: 303,
      publisher: "Knopf",
      subjects: "Literary fiction, Artificial intelligence, Family",
      body: "Klara, an Artificial Friend with remarkable powers of observation, watches the people around her and hopes to be chosen by a child.",
    },
    {
      title: "Educated",
      author: "Tara Westover",
      isbn: "9780399590504",
      datePublished: "2018",
      pageCount: 334,
      publisher: "Random House",
      subjects: "Memoir, Education, Family",
      body: "Raised in the mountains of Idaho without schooling, the author teaches herself enough to get into college and ends up with a PhD from Cambridge.",
    },
  ],
  maya: [
    {
      title: "Tomorrow, and Tomorrow, and Tomorrow",
      author: "Gabrielle Zevin",
      isbn: "9780593321201",
      datePublished: "2022",
      pageCount: 401,
      publisher: "Knopf",
      subjects: "Literary fiction, Video games, Friendship",
      body: "Two friends from childhood become creative partners designing video games, and spend thirty years building, breaking and remaking their bond.",
    },
    {
      title: "The Overstory",
      author: "Richard Powers",
      isbn: "9780393635522",
      datePublished: "2018",
      pageCount: 502,
      publisher: "W. W. Norton",
      subjects: "Literary fiction, Trees, Environmentalism",
      body: "Nine strangers, each shaped by a tree, are drawn together into a last stand to save the remaining old-growth forests.",
    },
    {
      title: "Normal People",
      author: "Sally Rooney",
      isbn: "9781984822178",
      datePublished: "2018",
      pageCount: 273,
      publisher: "Hogarth",
      subjects: "Literary fiction, Ireland, Relationships",
      body: "Connell and Marianne circle each other through school and university in Ireland, drawn together and pushed apart over several years.",
    },
    {
      title: "Gilead",
      author: "Marilynne Robinson",
      isbn: "9780312424404",
      datePublished: "2004",
      pageCount: 247,
      publisher: "Picador",
      subjects: "Literary fiction, Iowa, Faith",
      body: "An elderly preacher in a small Iowa town writes a long letter to his young son, recounting the history of his family.",
    },
    {
      title: "The Name of the Wind",
      author: "Patrick Rothfuss",
      isbn: "9780756404741",
      datePublished: "2007",
      pageCount: 662,
      publisher: "DAW Books",
      subjects: "Fantasy, Magic, Music",
      body: "A legendary figure, now hiding as an innkeeper, tells the true story of his life, from a childhood with travelling players to the arcane university.",
    },
    {
      title: "Beloved",
      author: "Toni Morrison",
      isbn: "9781400033416",
      datePublished: "1987",
      pageCount: 324,
      publisher: "Vintage",
      subjects: "Literary fiction, Slavery, Memory",
      body: "In post-Civil War Ohio, a woman who escaped slavery is haunted by her past and by the mysterious young woman who arrives at her door.",
    },
  ],
  sam: [
    {
      title: "Sapiens",
      author: "Yuval Noah Harari",
      isbn: "9780062316097",
      datePublished: "2011",
      pageCount: 443,
      publisher: "Harper",
      subjects: "History, Anthropology, Evolution",
      body: "A brief history of humankind, from the first humans to walk the earth through the revolutions that shaped how we live today.",
    },
    {
      title: "The Martian",
      author: "Andy Weir",
      isbn: "9780553418026",
      datePublished: "2011",
      pageCount: 387,
      publisher: "Crown",
      subjects: "Science fiction, Mars, Survival",
      body: "Stranded on Mars after his crew leaves him for dead, an astronaut has to science his way through every problem the planet throws at him.",
    },
    {
      title: "Born a Crime",
      author: "Trevor Noah",
      isbn: "9780399588198",
      datePublished: "2016",
      pageCount: 288,
      publisher: "Spiegel & Grau",
      subjects: "Memoir, South Africa, Comedy",
      body: "Stories from a childhood in South Africa during the last days of apartheid, told with warmth and sharp humor.",
    },
    {
      title: "Atomic Habits",
      author: "James Clear",
      isbn: "9780735211292",
      datePublished: "2018",
      pageCount: 320,
      publisher: "Avery",
      subjects: "Self-help, Habits, Productivity",
      body: "A practical framework for building good habits and breaking bad ones through small changes that compound over time.",
    },
    {
      title: "The Road",
      author: "Cormac McCarthy",
      isbn: "9780307387899",
      datePublished: "2006",
      pageCount: 287,
      publisher: "Vintage",
      subjects: "Post-apocalyptic fiction, Fathers and sons",
      body: "A father and his son walk south through a burned and empty America, carrying only what they need to survive.",
    },
  ],
  priya: [
    {
      title: "Jonathan Strange & Mr Norrell",
      author: "Susanna Clarke",
      isbn: "9780765356154",
      datePublished: "2004",
      pageCount: 1006,
      publisher: "Tor Books",
      subjects: "Fantasy, Magic, Historical fiction",
      body: "In Napoleonic England, two very different magicians revive English magic, become master and pupil, then rivals, as the old magic stirs back to life.",
    },
    {
      title: "The Midnight Library",
      author: "Matt Haig",
      isbn: "9780525559474",
      datePublished: "2020",
      pageCount: 304,
      publisher: "Viking",
      subjects: "Fiction, Regret, Parallel lives",
      body: "Between life and death there is a library, and every book in it lets Nora try out a life she might have lived.",
    },
    {
      title: "Never Let Me Go",
      author: "Kazuo Ishiguro",
      isbn: "9781400078776",
      datePublished: "2005",
      pageCount: 288,
      publisher: "Vintage",
      subjects: "Literary fiction, Dystopia, Friendship",
      body: "Kathy looks back on her years at Hailsham, an English boarding school, and slowly reveals what its students were raised for.",
    },
    {
      title: "Anxious People",
      author: "Fredrik Backman",
      isbn: "9781501160837",
      datePublished: "2019",
      pageCount: 341,
      publisher: "Atria Books",
      subjects: "Fiction, Sweden, Humor",
      body: "A failed bank robber takes a group of strangers hostage at an apartment viewing, and nothing goes the way anyone expects.",
    },
    {
      title: "Where the Crawdads Sing",
      author: "Delia Owens",
      isbn: "9780735219090",
      datePublished: "2018",
      pageCount: 368,
      publisher: "G.P. Putnam's Sons",
      subjects: "Fiction, North Carolina, Marshes",
      body: "Abandoned as a child, Kya grows up alone in the marshes of the North Carolina coast and becomes a suspect in a local man's death.",
    },
  ],
  theo: [
    {
      title: "The Three-Body Problem",
      author: "Cixin Liu",
      isbn: "9780765382030",
      datePublished: "2008",
      pageCount: 400,
      publisher: "Tor Books",
      subjects: "Science fiction, First contact, China",
      body: "A secret military project sends signals into space and reaches an alien civilization on the brink of destruction.",
    },
    {
      title: "The Way of Kings",
      author: "Brandon Sanderson",
      isbn: "9780765326355",
      datePublished: "2010",
      pageCount: 1007,
      publisher: "Tor Books",
      subjects: "Fantasy, War, Magic",
      body: "On a storm-wracked world, a slave, a scholar and a highprince are drawn into a war that may decide the fate of everything.",
    },
  ],
  lena: [
    {
      title: "Middlemarch",
      author: "George Eliot",
      isbn: "9780141439549",
      datePublished: "1871",
      pageCount: 880,
      publisher: "Penguin Classics",
      subjects: "Classics, England, Marriage",
      body: "The lives and ambitions of the people of a provincial English town intertwine over a few eventful years.",
    },
    {
      title: "Jane Eyre",
      author: "Charlotte Brontë",
      isbn: "9780141441146",
      datePublished: "1847",
      pageCount: 532,
      publisher: "Penguin Classics",
      subjects: "Classics, Gothic fiction, Governesses",
      body: "An orphaned governess takes a post at Thornfield Hall and falls for its brooding master, who is hiding a secret.",
    },
    {
      title: "Rebecca",
      author: "Daphne du Maurier",
      isbn: "9780380730407",
      datePublished: "1938",
      pageCount: 410,
      publisher: "Harper",
      subjects: "Gothic fiction, Suspense, Cornwall",
      body: "A young bride arrives at Manderley, her husband's grand estate, and finds it still ruled by the memory of his first wife.",
    },
  ],
};

export async function deleteDemoGroup(demoGroup: string) {
  const users = await prisma.user.findMany({
    where: { demoGroup },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;

  // These relations don't cascade, so clear them before removing the users
  await prisma.notification.deleteMany({
    where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] },
  });
  await prisma.lendingHistory.deleteMany({
    where: { borrowerId: { in: ids } },
  });
  await prisma.book.updateMany({
    where: { borrowerId: { in: ids } },
    data: { borrowerId: null, borrowedAt: null, dueDate: null },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function deleteExpiredDemoGroups() {
  const expired = await prisma.user.findMany({
    where: {
      demoGroup: { not: null },
      createdAt: { lt: ago(DEMO_TTL_HOURS * hour) },
    },
    select: { demoGroup: true },
    distinct: ["demoGroup"],
  });
  for (const { demoGroup } of expired) {
    if (demoGroup) await deleteDemoGroup(demoGroup);
  }
}

// Builds a fresh, populated sandbox and returns the visitor's user id
export async function createDemoSandbox(): Promise<User["id"]> {
  await deleteExpiredDemoGroups();

  const demoGroup = crypto.randomUUID();
  const tag = demoGroup.slice(0, 8);

  const people = { you: VISITOR, ...PERSONAS };
  const ids = {} as Record<OwnerKey, string>;
  const names = {} as Record<OwnerKey, string>;

  for (const [key, person] of Object.entries(people) as [
    OwnerKey,
    (typeof people)[OwnerKey],
  ][]) {
    const user = await prisma.user.create({
      data: {
        email: `${key}.${tag}@${DEMO_EMAIL_DOMAIN}`,
        firstname: person.firstname,
        surname: person.surname,
        profileEmoji: person.profileEmoji,
        emailNotifications: false,
        // createdAt stays real: expiry of the sandbox is measured from it
        demoGroup,
      },
    });
    ids[key] = user.id;
    names[key] = `${person.firstname} ${person.surname}`;
  }

  await prisma.user.update({
    where: { id: ids.you },
    data: { shareToken: crypto.randomUUID() },
  });

  // title -> book id, across every library in the sandbox
  const books: Record<string, string> = {};
  for (const [owner, library] of Object.entries(LIBRARIES) as [
    OwnerKey,
    DemoBook[],
  ][]) {
    for (const [i, { isbn, ...book }] of library.entries()) {
      const created = await prisma.book.create({
        data: {
          ...book,
          cover: cover(isbn),
          userId: ids[owner],
          // Spread the "added" dates out so the shelf has a natural order
          createdAt: ago((i + 1) * 3 * day),
        },
      });
      books[book.title] = created.id;
    }
  }

  for (const friend of ["maya", "sam", "priya"] as const) {
    await createFriendship(ids.you, ids[friend]);
  }
  await createFriendship(ids.maya, ids.sam);
  await createFriendship(ids.sam, ids.priya);
  await createFriendship(ids.priya, ids.lena);

  // Lending: past loans (returned) and current ones
  const loans: {
    title: string;
    borrower: OwnerKey;
    borrowedAt: Date;
    returnedAt?: Date;
    dueDate?: Date;
  }[] = [
    {
      title: "Project Hail Mary",
      borrower: "sam",
      borrowedAt: ago(80 * day),
      returnedAt: ago(55 * day),
    },
    {
      title: "Dune",
      borrower: "maya",
      borrowedAt: ago(120 * day),
      returnedAt: ago(95 * day),
    },
    {
      title: "Dune",
      borrower: "priya",
      borrowedAt: ago(70 * day),
      returnedAt: ago(48 * day),
    },
    {
      title: "Circe",
      borrower: "maya",
      borrowedAt: ago(26 * day),
      returnedAt: ago(1 * day),
    },
    {
      title: "The Hobbit",
      borrower: "sam",
      borrowedAt: ago(60 * day),
      returnedAt: ago(40 * day),
    },
    {
      title: "The Martian",
      borrower: "you",
      borrowedAt: ago(100 * day),
      returnedAt: ago(85 * day),
    },
    {
      title: "Station Eleven",
      borrower: "maya",
      borrowedAt: ago(150 * day),
      returnedAt: ago(128 * day),
    },
    {
      title: "Educated",
      borrower: "priya",
      borrowedAt: ago(90 * day),
      returnedAt: ago(62 * day),
    },
    {
      title: "Klara and the Sun",
      borrower: "sam",
      borrowedAt: ago(75 * day),
      returnedAt: ago(58 * day),
    },
    {
      title: "Braiding Sweetgrass",
      borrower: "maya",
      borrowedAt: ago(110 * day),
      returnedAt: ago(70 * day),
    },
    {
      title: "Normal People",
      borrower: "you",
      borrowedAt: ago(140 * day),
      returnedAt: ago(125 * day),
    },
    {
      title: "Anxious People",
      borrower: "you",
      borrowedAt: ago(65 * day),
      returnedAt: ago(45 * day),
    },
    // Current loans
    {
      title: "Project Hail Mary",
      borrower: "maya",
      borrowedAt: ago(16 * day),
      dueDate: fromNow(12 * day),
    },
    {
      title: "Piranesi",
      borrower: "sam",
      borrowedAt: ago(33 * day),
      dueDate: ago(5 * day),
    },
    {
      title: "Sapiens",
      borrower: "you",
      borrowedAt: ago(6 * day),
      dueDate: fromNow(22 * day),
    },
    {
      title: "Jonathan Strange & Mr Norrell",
      borrower: "you",
      borrowedAt: ago(26 * day),
      dueDate: fromNow(2 * day),
    },
    {
      title: "Station Eleven",
      borrower: "priya",
      borrowedAt: ago(19 * day),
      dueDate: fromNow(9 * day),
    },
    {
      title: "A Gentleman in Moscow",
      borrower: "maya",
      borrowedAt: ago(8 * day),
      dueDate: fromNow(20 * day),
    },
    {
      title: "The Left Hand of Darkness",
      borrower: "sam",
      borrowedAt: ago(11 * day),
      dueDate: fromNow(17 * day),
    },
    {
      title: "Gilead",
      borrower: "you",
      borrowedAt: ago(12 * day),
      dueDate: fromNow(16 * day),
    },
    {
      title: "Never Let Me Go",
      borrower: "you",
      borrowedAt: ago(3 * day),
      dueDate: fromNow(25 * day),
    },
  ];

  for (const loan of loans) {
    const bookId = books[loan.title];
    await prisma.lendingHistory.create({
      data: {
        bookId,
        borrowerId: ids[loan.borrower],
        borrowedAt: loan.borrowedAt,
        returnedAt: loan.returnedAt ?? null,
      },
    });
    await prisma.book.update({
      where: { id: bookId },
      data: {
        lendCount: { increment: 1 },
        ...(loan.dueDate
          ? {
              borrowerId: ids[loan.borrower],
              borrowedAt: loan.borrowedAt,
              dueDate: loan.dueDate,
            }
          : {}),
      },
    });
  }

  // Reader notes: hearts and short notes from the owner and past borrowers
  const readerNotes: {
    title: string;
    by: OwnerKey;
    loved: boolean;
    body?: string;
    at: Date;
  }[] = [
    {
      title: "Dune",
      by: "you",
      loved: true,
      body: "Read it every few years and catch something new each time.",
      at: ago(130 * day),
    },
    {
      title: "Dune",
      by: "maya",
      loved: true,
      body: "Slow first hundred pages, then I couldn't put it down. Read the appendices!",
      at: ago(95 * day),
    },
    { title: "Dune", by: "priya", loved: true, at: ago(48 * day) },
    {
      title: "Project Hail Mary",
      by: "sam",
      loved: true,
      body: "Rocky is the best character in any book I've read this year.",
      at: ago(55 * day),
    },
    {
      title: "Circe",
      by: "maya",
      loved: true,
      body: "Gorgeous. The chapters on Aiaia felt like a long summer.",
      at: ago(1 * day),
    },
    {
      title: "Jonathan Strange & Mr Norrell",
      by: "priya",
      loved: true,
      body: "Long, strange and completely enchanting. Read the footnotes.",
      at: ago(60 * day),
    },
    // Your own shelf
    { title: "Piranesi", by: "you", loved: true, at: ago(40 * day) },
    {
      title: "Station Eleven",
      by: "you",
      loved: true,
      body: "Survival is insufficient. The best pandemic novel, written before the pandemic.",
      at: ago(160 * day),
    },
    { title: "Station Eleven", by: "maya", loved: true, at: ago(128 * day) },
    { title: "Circe", by: "you", loved: true, at: ago(30 * day) },
    { title: "The Remains of the Day", by: "you", loved: true, at: ago(90 * day) },
    {
      title: "Braiding Sweetgrass",
      by: "maya",
      loved: true,
      body: "Changed how I look at my garden. Take it slow, a chapter at a time.",
      at: ago(70 * day),
    },
    { title: "Braiding Sweetgrass", by: "you", loved: true, at: ago(120 * day) },
    { title: "The Left Hand of Darkness", by: "you", loved: true, at: ago(200 * day) },
    {
      title: "Educated",
      by: "priya",
      loved: true,
      body: "Hard to read in places, impossible to stop.",
      at: ago(62 * day),
    },
    {
      title: "Klara and the Sun",
      by: "sam",
      loved: false,
      body: "Quieter than I expected. Klara stuck with me for weeks though.",
      at: ago(58 * day),
    },
    { title: "The Hobbit", by: "sam", loved: true, at: ago(40 * day) },
    { title: "The Hobbit", by: "you", loved: true, at: ago(300 * day) },
    { title: "A Gentleman in Moscow", by: "you", loved: true, at: ago(180 * day) },
    { title: "Pachinko", by: "you", loved: true, at: ago(220 * day) },
    // Friends' shelves
    { title: "The Martian", by: "you", loved: true, at: ago(85 * day) },
    { title: "The Martian", by: "sam", loved: true, at: ago(400 * day) },
    {
      title: "Normal People",
      by: "you",
      loved: false,
      body: "Read it in two sittings. Not sure I liked them, but I believed them.",
      at: ago(125 * day),
    },
    { title: "Normal People", by: "maya", loved: true, at: ago(300 * day) },
    { title: "Anxious People", by: "you", loved: true, at: ago(45 * day) },
    { title: "Anxious People", by: "priya", loved: true, at: ago(250 * day) },
    { title: "The Overstory", by: "maya", loved: true, at: ago(200 * day) },
    { title: "Tomorrow, and Tomorrow, and Tomorrow", by: "maya", loved: true, at: ago(90 * day) },
    { title: "The Road", by: "sam", loved: true, at: ago(150 * day) },
    { title: "The Midnight Library", by: "priya", loved: true, at: ago(120 * day) },
  ];

  for (const note of readerNotes) {
    await prisma.readerNote.create({
      data: {
        bookId: books[note.title],
        userId: ids[note.by],
        loved: note.loved,
        body: note.body ?? null,
        createdAt: note.at,
        updatedAt: note.at,
      },
    });
  }

  const notifications: {
    type: string;
    from: OwnerKey;
    to: OwnerKey;
    title?: string;
    at: Date;
    actionTaken?: string;
  }[] = [
    // Waiting on the visitor
    { type: "FRIEND_REQUEST", from: "theo", to: "you", at: ago(2 * hour) },
    {
      type: "BOOK_REQUEST",
      from: "sam",
      to: "you",
      title: "Dune",
      at: ago(5 * hour),
    },
    {
      type: "BOOK_RETURNED",
      from: "maya",
      to: "you",
      title: "Circe",
      at: ago(1 * day),
    },
    {
      type: "DUE_SOON_REMINDER",
      from: "priya",
      to: "you",
      title: "Jonathan Strange & Mr Norrell",
      at: ago(3 * hour),
    },
    {
      type: "READER_NOTE",
      from: "maya",
      to: "you",
      title: "Circe",
      at: ago(1 * day),
    },
    // The visitor's own request, still pending with Maya
    {
      type: "BOOK_REQUEST",
      from: "you",
      to: "maya",
      title: "The Overstory",
      at: ago(1 * day),
    },
    // History
    {
      type: "BOOK_APPROVED",
      from: "sam",
      to: "you",
      title: "Sapiens",
      at: ago(6 * day),
      actionTaken: "dismissed",
    },
    {
      type: "BOOK_REQUEST",
      from: "maya",
      to: "you",
      title: "Project Hail Mary",
      at: ago(16 * day),
      actionTaken: "approved",
    },
    {
      type: "BOOK_APPROVED",
      from: "priya",
      to: "you",
      title: "Jonathan Strange & Mr Norrell",
      at: ago(26 * day),
      actionTaken: "dismissed",
    },
    {
      type: "BOOK_REQUEST",
      from: "maya",
      to: "you",
      title: "Circe",
      at: ago(26 * day),
      actionTaken: "approved",
    },
    {
      type: "BOOK_REQUEST",
      from: "sam",
      to: "you",
      title: "Piranesi",
      at: ago(33 * day),
      actionTaken: "approved",
    },
    {
      type: "FRIEND_REQUEST",
      from: "priya",
      to: "you",
      at: ago(75 * day),
      actionTaken: "accepted",
    },
    {
      type: "BOOK_RETURNED",
      from: "sam",
      to: "you",
      title: "Project Hail Mary",
      at: ago(55 * day),
      actionTaken: "dismissed",
    },
  ];

  for (const n of notifications) {
    await prisma.notification.create({
      data: {
        type: n.type,
        senderId: ids[n.from],
        receiverId: ids[n.to],
        senderName: names[n.from],
        bookId: n.title ? books[n.title] : null,
        bookTitle: n.title ?? null,
        read: n.actionTaken !== undefined,
        actionTaken: n.actionTaken ?? null,
        createdAt: n.at,
      },
    });
  }

  return ids.you;
}

export async function getDemoGroup(userId: User["id"]) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { demoGroup: true },
  });
  return user?.demoGroup ?? null;
}

// Real accounts and demo sandboxes never see or reach each other
export async function canInteract(userId: User["id"], otherId: User["id"]) {
  const [a, b] = await Promise.all([
    getDemoGroup(userId),
    getDemoGroup(otherId),
  ]);
  return a === b;
}

// The made-up friends answer straight away, so visitors see the whole flow.
// Only demo users ever reach them, so this is a no-op for real accounts.
export async function respondAsDemoPersona(notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: {
      id: true,
      type: true,
      senderId: true,
      bookId: true,
      bookTitle: true,
      receiver: {
        select: { id: true, firstname: true, surname: true, demoGroup: true },
      },
    },
  });
  if (!notification?.receiver.demoGroup) return;

  const persona = notification.receiver;

  if (notification.type === "FRIEND_REQUEST") {
    await createFriendship(persona.id, notification.senderId);
    await markNotificationAsRead(notification.id, "accepted");
  }

  if (notification.type === "BOOK_REQUEST" && notification.bookId) {
    const book = await prisma.book.findUnique({
      where: { id: notification.bookId },
      select: { borrowerId: true },
    });
    if (book?.borrowerId) return;

    await lendBook(notification.bookId, notification.senderId);
    await createBookApprovedNotification(
      persona.id,
      notification.senderId,
      `${persona.firstname} ${persona.surname}`,
      notification.bookTitle ?? "",
    );
    await markNotificationAsRead(notification.id, "approved");
  }
}
