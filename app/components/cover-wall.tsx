// A faded wall of book covers behind the landing page
const ISBNS = [
  "9780593135204",
  "9781635575637",
  "9780441172719",
  "9780316556347",
  "9780679731726",
  "9780804172448",
  "9781571313560",
  "9780143110439",
  "9780441478125",
  "9781455563920",
  "9780374533557",
  "9780547928227",
  "9780593318171",
  "9780399590504",
  "9780593321201",
  "9780393635522",
  "9781984822178",
  "9780312424404",
  "9780756404741",
  "9781400033416",
  "9780062316097",
  "9780553418026",
  "9780399588198",
  "9780735211292",
  "9780307387899",
  "9780385547345",
  "9780525559474",
];

// Open Library cover IDs, which load faster than ISBN lookups
const COVER_IDS = [
  10618463, // The Left Hand of Darkness
  6979680, // The Dispossessed
  13617691, // A Wizard of Earthsea
  26458, // The Lathe of Heaven
  2237620, // Norwegian Wood
  11153243, // 1Q84
  14558822, // Hard-Boiled Wonderland and the End of the World
  8750439, // How to Do Nothing
  13246983, // Saving Time
  524560, // Blindsight
  8457790, // Echopraxia
  1443125, // Starfish
  11465138, // Sea of Tranquility
  9314949, // The Glass Hotel
  525391, // Jonathan Strange & Mr Norrell
  10466266, // Parable of the Sower
  12384358, // Parable of the Talents
  8745330, // Kindred
  285158, // Dawn
  11481354, // Dune
  283860, // Neuromancer
  380332, // Hyperion
  12313764, // Solaris
  8408974, // Annihilation
  8264706, // Children of Time
  7355949, // Ancillary Justice
  14612610, // Foundation
  392508, // Snow Crash
  11263774, // The Brothers Karamazov
  13116014, // Crime and Punishment
  6908257, // Notes from Underground
  10249475, // The Idiot
  12327215, // Anna Karenina
  12621906, // War and Peace
  15013644, // The Master and Margarita
  10544254, // Moby Dick
  252882, // Middlemarch
  15185412, // One Hundred Years of Solitude
];

const COVERS = [
  ...COVER_IDS.map((id) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`),
  ...ISBNS.map((isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`),
];

const COLUMNS = 16;
const ROWS = 9;

// Clear in the middle so the heading and card stay readable
const MASK =
  "radial-gradient(ellipse 60% 55% at 50% 50%, transparent 30%, black 90%)";

export default function CoverWall() {
  const tiles = Array.from({ length: COLUMNS * ROWS }, (_, i) => {
    // Step through the list so neighbours rarely repeat
    return COVERS[(i * 7) % COVERS.length];
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ maskImage: MASK, WebkitMaskImage: MASK }}
    >
      <div
        className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 gap-4 opacity-20 grayscale dark:opacity-15"
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, 7rem)` }}
      >
        {tiles.map((src, i) => (
          <div
            key={i}
            className={`aspect-[2/3] overflow-hidden rounded-xs bg-stone-200 dark:bg-stone-800 ${
              i % 2 ? "translate-y-8" : ""
            }`}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
