import type { User } from "@prisma/client";

import { prisma } from "~/db.server";
import { lendBook } from "~/models/book.server";
import {
  createBookApprovedNotification,
  createFriendship,
  deleteUsers,
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


// Each demo book's Open Library cover, by cover ID: the picture its ISBN
// leads to, checked to be a real one. Covers asked for by ISBN count
// against Open Library's rate limit (about 100 every five minutes), and a
// demo shelf asks for dozens at once, so the overflow came back as
// placeholders. Asked for by ID, they aren't limited.
const COVER_IDS: Record<string, number> = {
  "9780593135204": 12455001,
  "9781635575637": 10226290,
  "9780441172719": 15166231,
  "9780316556347": 8283869,
  "9780345404473": 208553,
  "9780804172448": 7369961,
  "9781571313560": 12836879,
  "9780143110439": 12064129,
  "9780374104092": 10520611,
  "9781455563920": 8755926,
  "9780063021426": 14573249,
  "9780547928227": 12003329,
  "9780593318171": 10673548,
  "9780399590504": 14832082,
  "9780063337879": 15104806,
  "9780593321201": 12816990,
  "9780393635522": 8758252,
  "9781984822178": 15228808,
  "9780593801970": 14831770,
  "9780756404741": 8259445,
  "9781400033416": 15248310,
  "9780062060624": 15160443,
  "9781982168438": 13253465,
  "9780385534635": 8750523,
  "9781101947883": 8793546,
  "9780062316097": 8594920,
  "9780553418026": 12065533,
  "9780399588198": 12063911,
  "9780735211292": 12886417,
  "9780307387899": 14818095,
  "9780553283686": 369091,
  "9780441569595": 283860,
  "9781250186430": 8802134,
  "9781612197494": 8750439,
  "9780316421997": 8753949,
  "9780525559474": 15164860,
  "9781400078776": 13160732,
  "9781501160837": 10087939,
  "9780735219090": 13011470,
  "9781501161933": 15255141,
  "9780525620785": 10239163,
  "9781250789068": 12166131,
  "9781250313188": 10139515,
  "9780765382030": 8478888,
  "9780765326355": 7429768,
  "9780316229296": 14614853,
  "9780141439686": 9279141,
  "9780156628709": 6929140,
  "9780141439549": 109037,
  "9780141441146": 109090,
  "9780380730407": 8765889,
  "9780593321447": 11642160,
  "9780547572291": 14814765,
  "9780812995343": 7909378,
  "9781534430990": 10304444,
  "9780307352156": 8142530,
  "9780671683900": 8376342,
  "9780063251922": 14817076,
};

function cover(isbn: string) {
  const id = COVER_IDS[isbn];
  return id
    ? `https://covers.openlibrary.org/b/id/${id}-L.jpg`
    : `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
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

// Friends have picked icons, each in its own color, to show what's there
// to choose from. The visitor keeps the plain initials their name gives,
// so choosing a picture is theirs to try.
const PERSONAS = {
  maya: { firstname: "Maya", surname: "Chen", profileEmoji: "flower:plum" },
  sam: { firstname: "Sam", surname: "Okafor", profileEmoji: "planet:navy" },
  anika: { firstname: "Anika", surname: "Rao", profileEmoji: "cat:oxblood" },
  // Theo has sent the visitor a friend request; Lena shows up as a suggestion
  theo: { firstname: "Theo", surname: "Martin", profileEmoji: "discoball:ochre" },
  lena: { firstname: "Lena", surname: "Fischer", profileEmoji: "frog:forest" },
  // The visitor's housemate: one shared shelf, their own notes and friends
  noah: { firstname: "Noah", surname: "Brennan", profileEmoji: "diamond:ink" },
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
      title: "Do Androids Dream of Electric Sheep?",
      author: "Philip K. Dick",
      isbn: "9780345404473",
      datePublished: "1968",
      pageCount: 210,
      publisher: "Del Rey",
      subjects: "Science fiction, Androids, Empathy",
      body: "In a dusty, half-empty San Francisco, a bounty hunter tracks down escaped androids and starts to wonder what makes anyone human.",
    },
    {
      title: "Station Eleven",
      author: "Emily St. John Mandel",
      isbn: "9780804172448",
      datePublished: "2014",
      pageCount: 333,
      publisher: "Vintage",
      subjects: "Post-apocalyptic fiction, Theater, Survival",
      body: "Years after a pandemic collapses civilization, a traveling troupe of actors and musicians performs Shakespeare for the scattered settlements of the Great Lakes.",
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
      title: "Annihilation",
      author: "Jeff VanderMeer",
      isbn: "9780374104092",
      datePublished: "2014",
      pageCount: 195,
      publisher: "FSG Originals",
      subjects: "Science fiction, Horror, Nature",
      body: "Four women enter Area X, a coastline cut off from the world for decades, as the twelfth expedition to try to understand it.",
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
      title: "Babel",
      author: "R. F. Kuang",
      isbn: "9780063021426",
      datePublished: "2022",
      pageCount: 545,
      publisher: "Harper Voyager",
      subjects: "Fantasy, Translation, Empire",
      body: "At Oxford's royal institute of translation, where silver bars hold the magic of words lost between languages, a student begins to see whom the empire really serves.",
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
      title: "Rejection",
      author: "Tony Tulathimutte",
      isbn: "9780063337879",
      datePublished: "2024",
      pageCount: 272,
      publisher: "William Morrow",
      subjects: "Literary fiction, Short stories, Satire",
      body: "Linked stories about people turned down by lovers, friends and the internet, and how far each of them goes once the no has sunk in.",
    },
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
      title: "The City and Its Uncertain Walls",
      author: "Haruki Murakami",
      isbn: "9780593801970",
      datePublished: "2024",
      pageCount: 464,
      publisher: "Knopf",
      subjects: "Literary fiction, Magical realism, Japan",
      body: "A man spends his life drawn back to a walled city a girl once described to him, where he reads old dreams in a library, and later finds a library of his own in a small mountain town.",
    },
    {
      title: "The Name of the Wind",
      author: "Patrick Rothfuss",
      isbn: "9780756404741",
      datePublished: "2007",
      pageCount: 662,
      publisher: "DAW Books",
      subjects: "Fantasy, Magic, Music",
      body: "A legendary figure, now hiding as an innkeeper, tells the true story of his life, from a childhood with traveling players to the arcane university.",
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
    {
      title: "The Song of Achilles",
      author: "Madeline Miller",
      isbn: "9780062060624",
      datePublished: "2011",
      pageCount: 378,
      publisher: "Ecco",
      subjects: "Greek mythology, Romance, War",
      body: "Patroclus tells the story of his life beside Achilles, from boyhood exile to the walls of Troy.",
    },
    {
      title: "Cloud Cuckoo Land",
      author: "Anthony Doerr",
      isbn: "9781982168438",
      datePublished: "2021",
      pageCount: 622,
      publisher: "Scribner",
      subjects: "Literary fiction, Libraries, Time",
      body: "An ancient Greek tale links lives across centuries, from besieged Constantinople to a small-town library to a ship bound for another world.",
    },
    {
      title: "The Night Circus",
      author: "Erin Morgenstern",
      isbn: "9780385534635",
      datePublished: "2011",
      pageCount: 387,
      publisher: "Doubleday",
      subjects: "Fantasy, Magic, Romance",
      body: "A circus that opens only at night is the arena for a duel between two young magicians who were never meant to fall in love.",
    },
  ],
  sam: [
    {
      title: "Exhalation",
      author: "Ted Chiang",
      isbn: "9781101947883",
      datePublished: "2019",
      pageCount: 350,
      publisher: "Knopf",
      subjects: "Science fiction, Short stories, Philosophy",
      body: "Stories about time travel, free will and artificial minds, each built around one big idea worked out with care.",
    },
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
    {
      title: "Hyperion",
      author: "Dan Simmons",
      isbn: "9780553283686",
      datePublished: "1989",
      pageCount: 482,
      publisher: "Bantam",
      subjects: "Science fiction, Space opera, Pilgrimage",
      body: "Seven pilgrims travel to the Time Tombs on a far-off world, each telling the story of why they came.",
    },
    {
      title: "Neuromancer",
      author: "William Gibson",
      isbn: "9780441569595",
      datePublished: "1984",
      pageCount: 271,
      publisher: "Ace",
      subjects: "Science fiction, Cyberpunk, Hackers",
      body: "A washed-up hacker is hired for one last job inside a vast computer network, in the book that gave cyberspace its name.",
    },
    {
      title: "A Memory Called Empire",
      author: "Arkady Martine",
      isbn: "9781250186430",
      datePublished: "2019",
      pageCount: 462,
      publisher: "Tor",
      subjects: "Science fiction, Empire, Diplomacy",
      body: "A new ambassador arrives at the heart of a vast empire to find her predecessor dead and nobody willing to say how.",
    },
  ],
  anika: [
    {
      title: "How to Do Nothing",
      author: "Jenny Odell",
      isbn: "9781612197494",
      datePublished: "2019",
      pageCount: 256,
      publisher: "Melville House",
      subjects: "Nonfiction, Attention, Technology",
      body: "An artist makes the case for taking your attention back from the feeds that want it, and giving it to the places, people and birds around you.",
    },
    {
      title: "The Ten Thousand Doors of January",
      author: "Alix E. Harrow",
      isbn: "9780316421997",
      datePublished: "2019",
      pageCount: 374,
      publisher: "Redhook",
      subjects: "Fantasy, Portals, Adventure",
      body: "In the early 1900s a girl finds a book about doors to other worlds, and starts to suspect it's about her own family.",
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
    {
      title: "The Seven Husbands of Evelyn Hugo",
      author: "Taylor Jenkins Reid",
      isbn: "9781501161933",
      datePublished: "2017",
      pageCount: 389,
      publisher: "Atria",
      subjects: "Historical fiction, Hollywood, Romance",
      body: "An aging film star finally tells her life story, all seven marriages of it, to an unknown magazine writer.",
    },
    {
      title: "Mexican Gothic",
      author: "Silvia Moreno-Garcia",
      isbn: "9780525620785",
      datePublished: "2020",
      pageCount: 301,
      publisher: "Del Rey",
      subjects: "Gothic fiction, Horror, Mexico",
      body: "A socialite travels to a decaying mansion in the Mexican countryside after her cousin sends a frantic letter.",
    },
    {
      title: "Light from Uncommon Stars",
      author: "Ryka Aoki",
      isbn: "9781250789068",
      datePublished: "2021",
      pageCount: 373,
      publisher: "Tor",
      subjects: "Fantasy, Science fiction, Music",
      body: "A violin teacher who made a deal with the devil, a runaway trans girl with a gift, and an alien starship captain running a donut shop.",
    },
  ],
  theo: [
    {
      title: "Gideon the Ninth",
      author: "Tamsyn Muir",
      isbn: "9781250313188",
      datePublished: "2019",
      pageCount: 448,
      publisher: "Tor",
      subjects: "Fantasy, Science fiction, Necromancy",
      body: "A sword-fighting conscript and the necromancer she hates are summoned to a decaying palace to compete for immortality.",
    },
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
    {
      title: "The Fifth Season",
      author: "N. K. Jemisin",
      isbn: "9780316229296",
      datePublished: "2015",
      pageCount: 468,
      publisher: "Orbit",
      subjects: "Fantasy, Science fiction, Apocalypse",
      body: "On a continent wracked by catastrophic quakes, a woman searches for her daughter as the world ends again.",
    },
  ],
  lena: [
    {
      title: "Persuasion",
      author: "Jane Austen",
      isbn: "9780141439686",
      datePublished: "1817",
      pageCount: 249,
      publisher: "Penguin Classics",
      subjects: "Classics, Romance, Second chances",
      body: "Eight years after being persuaded to break off her engagement, Anne Elliot meets the man she gave up again.",
    },
    {
      title: "Mrs Dalloway",
      author: "Virginia Woolf",
      isbn: "9780156628709",
      datePublished: "1925",
      pageCount: 194,
      publisher: "Harcourt",
      subjects: "Classics, Modernism, London",
      body: "A single June day in London, as Clarissa Dalloway prepares for a party and the past keeps breaking in.",
    },
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
  noah: [
    {
      title: "Sea of Tranquility",
      author: "Emily St. John Mandel",
      isbn: "9780593321447",
      datePublished: "2022",
      pageCount: 255,
      publisher: "Knopf",
      subjects: "Science fiction, Time travel, Pandemics",
      body: "A strange moment in a forest in 1912 echoes through a writer's book tour on the moon and an investigator sent from five hundred years later.",
    },
    {
      title: "Ubik",
      author: "Philip K. Dick",
      isbn: "9780547572291",
      datePublished: "1969",
      pageCount: 216,
      publisher: "Mariner Books",
      subjects: "Science fiction, Reality, Time",
      body: "After a bomb goes off on the Moon, a team of psychics finds the world around them decaying, and messages from their boss appearing in the strangest places.",
    },
    {
      title: "Lincoln in the Bardo",
      author: "George Saunders",
      isbn: "9780812995343",
      datePublished: "2017",
      pageCount: 343,
      publisher: "Random House",
      subjects: "Literary fiction, History, Ghosts",
      body: "On the night of his son's funeral, the president visits the cemetery, where a chorus of restless spirits watches.",
    },
    {
      title: "This Is How You Lose the Time War",
      author: "Amal El-Mohtar and Max Gladstone",
      isbn: "9781534430990",
      datePublished: "2019",
      pageCount: 209,
      publisher: "Saga Press",
      subjects: "Science fiction, Romance, Letters",
      body: "Two agents on opposite sides of a war across time start leaving each other letters, and fall for the enemy.",
    },
    {
      title: "Quiet",
      author: "Susan Cain",
      isbn: "9780307352156",
      datePublished: "2012",
      pageCount: 333,
      publisher: "Broadway Books",
      subjects: "Psychology, Introversion, Nonfiction",
      body: "Why introverts are undervalued in a culture that prizes talking, and what they bring that others don't.",
    },
  ],
};

export async function deleteDemoGroup(demoGroup: string) {
  const users = await prisma.user.findMany({
    where: { demoGroup },
    select: { id: true },
  });
  await deleteUsers(users.map((u) => u.id));
}

export async function deleteExpiredDemoGroups() {
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
        weeklyDigest: false,
        // createdAt stays real: expiry of the sandbox is measured from it
        demoGroup,
      },
    });
    ids[key] = user.id;
    names[key] = `${person.firstname} ${person.surname}`;
  }

  // No public link for the visitor yet, so the demo shows the "Share
  // your bookshelf" prompt

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

  for (const friend of ["maya", "sam", "anika"] as const) {
    await createFriendship(ids.you, ids[friend]);
  }
  await createFriendship(ids.maya, ids.sam);
  await createFriendship(ids.sam, ids.anika);
  await createFriendship(ids.anika, ids.lena);
  // Noah keeps his own friends: Maya and Anika
  await createFriendship(ids.noah, ids.maya);
  await createFriendship(ids.noah, ids.anika);

  // A book club the visitor started: everyone in it is friends with
  // everyone else, so Maya and Anika are too. Lena (a suggestion) and Theo
  // (a friend request) stay out of it.
  await createFriendship(ids.maya, ids.anika);
  await prisma.group.create({
    data: {
      name: "Thursday book club",
      inviteToken: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      createdAt: ago(45 * day),
      members: {
        create: (
          [
            ["you", 45],
            ["maya", 44],
            ["sam", 30],
            ["anika", 12],
          ] as const
        ).map(([key, days]) => ({ userId: ids[key], joinedAt: ago(days * day) })),
      },
    },
  });

  // The visitor and Noah share one shelf: his books show on theirs as
  // "Noah's", and either can lend them
  await prisma.household.create({
    data: { members: { connect: [{ id: ids.you }, { id: ids.noah }] } },
  });

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
      borrower: "anika",
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
      borrower: "anika",
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
    // Noah's books get around too
    {
      title: "Ubik",
      borrower: "maya",
      borrowedAt: ago(45 * day),
      returnedAt: ago(30 * day),
    },
    // Between friends: their copies have a history of their own
    {
      title: "The Song of Achilles",
      borrower: "anika",
      borrowedAt: ago(95 * day),
      returnedAt: ago(80 * day),
    },
    {
      title: "Exhalation",
      borrower: "maya",
      borrowedAt: ago(50 * day),
      returnedAt: ago(36 * day),
    },
    {
      title: "Lincoln in the Bardo",
      borrower: "anika",
      borrowedAt: ago(130 * day),
      returnedAt: ago(110 * day),
    },
    // Long ago: the visitor loved it but never said why, so History asks
    {
      title: "Hyperion",
      borrower: "you",
      borrowedAt: ago(170 * day),
      returnedAt: ago(150 * day),
    },
    // Current loans
    {
      title: "Sea of Tranquility",
      borrower: "anika",
      borrowedAt: ago(10 * day),
      dueDate: fromNow(18 * day),
    },
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
      title: "The Ten Thousand Doors of January",
      borrower: "you",
      borrowedAt: ago(26 * day),
      dueDate: fromNow(2 * day),
    },
    {
      title: "Station Eleven",
      borrower: "anika",
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
      title: "Annihilation",
      borrower: "sam",
      borrowedAt: ago(11 * day),
      dueDate: fromNow(17 * day),
    },
    {
      title: "The City and Its Uncertain Walls",
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
    // Between friends, so the visitor can get in line for it
    {
      title: "Normal People",
      borrower: "sam",
      borrowedAt: ago(9 * day),
      dueDate: fromNow(19 * day),
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

  // Anika and then Lena are waiting for Piranesi, which Sam still has
  for (const [person, waited] of [
    ["anika", 9],
    ["lena", 2],
  ] as const) {
    await prisma.hold.create({
      data: {
        bookId: books["Piranesi"],
        userId: ids[person],
        createdAt: ago(waited * day),
      },
    });
  }

  // The visitor has read a good part of their own shelf
  const read: [string, number][] = [
    ["Project Hail Mary", 60],
    ["Circe", 30],
    ["Do Androids Dream of Electric Sheep?", 90],
    ["Station Eleven", 140],
    ["Braiding Sweetgrass", 120],
    ["A Gentleman in Moscow", 180],
    ["Pachinko", 220],
    ["The Hobbit", 300],
    ["Dune", 130],
    ["Annihilation", 200],
    // From the shared shelf
    ["This Is How You Lose the Time War", 100],
  ];
  // Kept as the visitor's own mark; any heart or note is added to it below
  for (const [title, days] of read) {
    await prisma.readerNote.create({
      data: {
        bookId: books[title],
        userId: ids.you,
        readAt: ago(days * day),
        createdAt: ago(days * day),
        updatedAt: ago(days * day),
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
    { title: "Dune", by: "anika", loved: true, at: ago(48 * day) },
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
      title: "The Ten Thousand Doors of January",
      by: "anika",
      loved: true,
      body: "A book about books and doors. I wanted to walk into every one of them.",
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
    {
      title: "Do Androids Dream of Electric Sheep?",
      by: "you",
      loved: true,
      body: "Shorter and stranger than the film. The mood organ alone is worth it.",
      at: ago(90 * day),
    },
    {
      title: "Braiding Sweetgrass",
      by: "maya",
      loved: true,
      body: "Changed how I look at my garden. Take it slow, a chapter at a time.",
      at: ago(70 * day),
    },
    {
      title: "Braiding Sweetgrass",
      by: "you",
      loved: true,
      at: ago(120 * day),
    },
    {
      title: "Annihilation",
      by: "you",
      loved: true,
      at: ago(200 * day),
    },
    {
      title: "Educated",
      by: "anika",
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
    {
      title: "A Gentleman in Moscow",
      by: "you",
      loved: true,
      at: ago(180 * day),
    },
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
    { title: "Anxious People", by: "anika", loved: true, at: ago(250 * day) },
    {
      title: "Tomorrow, and Tomorrow, and Tomorrow",
      by: "maya",
      loved: true,
      at: ago(12 * day),
    },
    {
      title: "The Road",
      by: "sam",
      loved: true,
      body: "Bleak and beautiful. I read it in one sitting and then sat there for a while.",
      at: ago(9 * day),
    },
    {
      title: "The Midnight Library",
      by: "anika",
      loved: true,
      body: "Lighter than it sounds. A good one to pass around.",
      at: ago(5 * day),
    },
    {
      title: "The Overstory",
      by: "maya",
      loved: true,
      body: "Trees as the main characters, and it works. Happy to lend it.",
      at: ago(2 * day),
    },
    // New on friends' shelves. The newest notes take turns between
    // friends, so the top of the feed isn't one person twice in a row
    {
      title: "Rejection",
      by: "maya",
      loved: true,
      body: "Funny until it suddenly isn't. I read the first story twice.",
      at: ago(2.7 * day),
    },
    {
      title: "The Song of Achilles",
      by: "anika",
      loved: true,
      body: "I knew how it ended and still wasn't ready.",
      at: ago(80 * day),
    },
    {
      title: "The Song of Achilles",
      by: "maya",
      loved: true,
      at: ago(300 * day),
    },
    {
      title: "Exhalation",
      by: "maya",
      loved: true,
      body: "The parrot story made me cry on a bus. Start with that one.",
      at: ago(36 * day),
    },
    { title: "Exhalation", by: "sam", loved: true, at: ago(2.4 * day) },
    { title: "Hyperion", by: "you", loved: true, at: ago(150 * day) },
    { title: "Hyperion", by: "sam", loved: true, at: ago(500 * day) },
    {
      title: "How to Do Nothing",
      by: "anika",
      loved: true,
      body: "Read it on the porch with my phone in another room, which is the point.",
      at: ago(1.5 * day),
    },
    {
      title: "The Night Circus",
      by: "maya",
      loved: true,
      body: "Read it in the winter with the lights low. Perfect.",
      at: ago(200 * day),
    },
    { title: "Gideon the Ninth", by: "theo", loved: true, at: ago(5 * day) },
    { title: "The Fifth Season", by: "theo", loved: true, at: ago(20 * day) },
    {
      title: "Persuasion",
      by: "lena",
      loved: true,
      body: "The letter. You'll know it when you get there.",
      at: ago(8 * day),
    },
    // The household: Noah's own notes, on his books and on the visitor's
    {
      title: "Sea of Tranquility",
      by: "noah",
      loved: true,
      body: "Short, strange and lovely. It ties the whole of Station Eleven together in a way I didn't see coming.",
      at: ago(200 * day),
    },
    {
      title: "Ubik",
      by: "maya",
      loved: true,
      body: "No idea what was real by the end, and I mean that as a compliment.",
      at: ago(30 * day),
    },
    { title: "Ubik", by: "noah", loved: true, at: ago(250 * day) },
    {
      title: "Lincoln in the Bardo",
      by: "anika",
      loved: false,
      body: "Took me fifty pages to get the hang of it. Worth it.",
      at: ago(110 * day),
    },
    {
      title: "Dune",
      by: "noah",
      loved: false,
      body: "Finally read it because it lives on our shelf. The worm scenes, though.",
      at: ago(40 * day),
    },
    {
      title: "This Is How You Lose the Time War",
      by: "noah",
      loved: true,
      body: "Read it twice in a row. The letters get better the second time.",
      at: ago(90 * day),
    },
  ];

  for (const note of readerNotes) {
    const content = {
      loved: note.loved,
      body: note.body ?? null,
      createdAt: note.at,
      updatedAt: note.at,
    };
    await prisma.readerNote.upsert({
      where: {
        bookId_userId: { bookId: books[note.title], userId: ids[note.by] },
      },
      create: { bookId: books[note.title], userId: ids[note.by], ...content },
      update: content,
    });
  }

  // ...and a few books they're after. Three are on friends' shelves.
  const wanted = [
    { title: "The Overstory", author: "Richard Powers", isbn: "9780393635522" },
    {
      title: "Where the Crawdads Sing",
      author: "Delia Owens",
      isbn: "9780735219090",
    },
    { title: "Lonesome Dove", author: "Larry McMurtry", isbn: "9780671683900" },
    { title: "Rejection", author: "Tony Tulathimutte", isbn: "9780063337879" },
    {
      title: "Demon Copperhead",
      author: "Barbara Kingsolver",
      isbn: "9780063251922",
    },
  ];
  for (const [i, { isbn, ...book }] of wanted.entries()) {
    await prisma.wantToRead.create({
      data: {
        ...book,
        isbn,
        cover: cover(isbn),
        userId: ids.you,
        createdAt: ago((i + 2) * 9 * day),
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
    // Maya added a book from the visitor's want-to-read list
    {
      type: "WANT_MATCH",
      from: "maya",
      to: "you",
      title: "The Overstory",
      at: ago(2 * day),
    },
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
      from: "anika",
      to: "you",
      title: "The Ten Thousand Doors of January",
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
      from: "anika",
      to: "you",
      title: "The Ten Thousand Doors of January",
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
      from: "anika",
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
    {
      type: "WANT_MATCH",
      from: "maya",
      to: "you",
      title: "Rejection",
      at: ago(3 * day),
      actionTaken: "dismissed",
    },
    {
      type: "READER_NOTE",
      from: "anika",
      to: "you",
      title: "Dune",
      at: ago(48 * day),
      actionTaken: "dismissed",
    },
    // When each friendship started, for the friends page
    {
      type: "FRIEND_REQUEST",
      from: "you",
      to: "maya",
      at: ago(400 * day),
      actionTaken: "accepted",
    },
    {
      type: "FRIEND_REQUEST",
      from: "sam",
      to: "you",
      at: ago(230 * day),
      actionTaken: "accepted",
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
      notification.bookId,
      "Of course! I'm around Saturday morning if you want to grab it.",
    );
    await markNotificationAsRead(notification.id, "approved");
  }
}
