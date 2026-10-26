// Profile pictures: a small set of line icons, or the person's initials as
// a bookplate.
// The chosen key is stored in User.profileEmoji (named before icons
// replaced emoji); anything that isn't a known key, such as an emoji
// picked earlier, falls back to initials.

const ICON_PATHS = {
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8.5 5.5-14 15-14 0 9.5-5.5 15-15 14z" />
      <path d="M5 19 14 10" />
    </>
  ),
  bookmark: <path d="M7 3.5h10v17l-5-3.5-5 3.5z" />,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  star: (
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  ),
  mountain: (
    <>
      <path d="M2.5 20 9 8.5l4 7 2.5-4L21.5 20z" />
      <path d="M7.3 11.5 9 12.5l1.6-1" />
    </>
  ),
  wave: (
    <>
      <path d="M3 9.5c2.25-1.75 4.25-1.75 6 0s3.75 1.75 6 0 3.75-1.75 6 0" />
      <path d="M3 14.5c2.25-1.75 4.25-1.75 6 0s3.75 1.75 6 0 3.75-1.75 6 0" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 3.5v2.5M12 3.5v2.5" />
    </>
  ),
  moka: (
    <>
      {/* A stovetop espresso pot: two chambers pinched at the seam, and a
          handle. The lip and lid knob went: too much at small sizes */}
      <path d="M7.5 4.5h9L15 12l2 8.5H7l2-8.5z" />
      <path d="M9 12h6" />
      <path d="M16.3 6.2h2.7l-1.5 4.5h-2.2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  flower: (
    <>
      {/* Five petals in one outline over a solid center, a stem and one
          leaf, with room between the leaf and the petals */}
      <path d="M9.05 9.06A2.5 2.5 0 1 1 10.18 5.59A2.5 2.5 0 1 1 13.82 5.59A2.5 2.5 0 1 1 14.95 9.06A2.5 2.5 0 1 1 12 11.2A2.5 2.5 0 1 1 9.05 9.06z" />
      <circle cx="12" cy="8.1" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 13.7v7.9" />
      <path d="M12 19.2c.2-3 2.4-4.6 5.4-4.4-.2 3-2.4 4.7-5.4 4.4z" />
    </>
  ),
  glasses: (
    <>
      <circle cx="6.5" cy="14" r="3.5" />
      <circle cx="17.5" cy="14" r="3.5" />
      <path d="M10 14c1.2-1 2.8-1 4 0M3 14l1-6M21 14l-1-6" />
    </>
  ),
  watch: (
    <>
      {/* A digital watch, kept plain: straps, a rounded case, one line for
          the screen */}
      <path d="M8.5 6.5V2.5h7v4M8.5 17.5v4h7v-4" />
      <rect x="5" y="6.5" width="14" height="11" rx="2.5" />
      <path d="M9 12h6" />
    </>
  ),
  guy: (
    <>
      {/* Head and shoulders, the hair a solid cap so it holds up small */}
      <circle cx="12" cy="8.5" r="4.5" />
      <path d="M7.77 6.96A4.5 4.5 0 0 1 16.23 6.96Q12 5.4 7.77 6.96z" fill="currentColor" stroke="none" />
      <path d="M3.5 21c.8-4 4.3-6.3 8.5-6.3s7.7 2.3 8.5 6.3" />
    </>
  ),
  girl: (
    <>
      {/* Head and shoulders, solid hair framing the face, up in a bun */}
      <circle cx="12" cy="8.5" r="4.5" />
      <path d="M7.5 9.6C7.5 5.6 9.5 4 12 4s4.5 1.6 4.5 5.6c-1-1.6-2.5-2.3-4.5-2.3S8.5 8 7.5 9.6z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="3" r="1.4" fill="currentColor" stroke="none" />
      <path d="M3.5 21c.8-4 4.3-6.3 8.5-6.3s7.7 2.3 8.5 6.3" />
    </>
  ),
  cat: (
    <>
      {/* A kitty: a wide round face with soft-tipped ears, oval eyes, a
          button nose, and whiskers of one length that lie over the cheek and
          reach out past it, as the bunny's do. The face is 15 wide so
          they have room */}
      <path d="M4.99 11.4L5 6.3Q5.1 3.9 6.66 5.73L8.6 8A8 6 0 0 1 15.4 8L17.34 5.73Q18.9 3.9 19 6.3L19.01 11.4A7.5 7 0 1 1 4.99 11.4z" />
      <ellipse cx="9.3" cy="13.4" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="14.7" cy="13.4" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="15.7" rx="1.15" ry=".85" fill="currentColor" stroke="none" />
      <path d="M6.51 14.9l-4.25-0.67M7.53 17.1l-4.21 0.89M17.49 14.9l4.25-0.67M16.47 17.1l4.21 0.89" />
    </>
  ),
  paw: (
    <>
      {/* Four toes on an even arc over the pad, the outer two turned out */}
      <ellipse cx="5.7" cy="10.9" rx="1.5" ry="1.85" transform="rotate(-28 5.7 10.9)" />
      <ellipse cx="9.3" cy="6.9" rx="1.55" ry="2" transform="rotate(-10 9.3 6.9)" />
      <ellipse cx="14.7" cy="6.9" rx="1.55" ry="2" transform="rotate(10 14.7 6.9)" />
      <ellipse cx="18.3" cy="10.9" rx="1.5" ry="1.85" transform="rotate(28 18.3 10.9)" />
      <path d="M12 11.8c-2.5 0-5 2.9-5 5.4 0 1.5 1.2 2.5 2.5 2.5 1 0 1.6-.6 2.5-.6s1.5.6 2.5.6c1.3 0 2.5-1 2.5-2.5 0-2.5-2.5-5.4-5-5.4z" />
    </>
  ),
  fish: (
    <>
      {/* A salmon on the rise: a full body, forked tail, a fin on its back and
          an eye. Nothing more, so it still reads small */}
      <g transform="rotate(-18 12 12)">
        <path d="M6.5 11C9.5 7.6 15.5 6.8 19.4 9.4c.9.6 1.6 1.4 1.9 2.3-.9.8-2.3 1.4-3.9 1.6C13.5 14.6 9.5 14.2 6.5 13z" />
        <path d="M6.5 11 2.6 7.6c-.2 1.8 0 3.3.9 4.4-.9 1.1-1.1 2.6-.9 4.4L6.5 13" />
        <path d="M10.2 8.6c.8-1.6 2-2.7 3.5-3 .1 1-.2 1.9-.9 2.5" />
        <circle cx="18.7" cy="10.6" r=".7" fill="currentColor" stroke="none" />
      </g>
    </>
  ),
  owl: (
    <>
      {/* On the kitty's face, the same size: short tufts leaning out, big
          ringed eyes with pupils, and a beak below them, each clear of the
          others */}
      <path d="M4.99 11.4L4.7 7.6Q4.5 5.6 6.2 6.7L8.6 8.3A8 6 0 0 1 15.4 8.3L17.8 6.7Q19.5 5.6 19.3 7.6L19.01 11.4A7.5 7 0 1 1 4.99 11.4z" />
      <circle cx="8.9" cy="12.2" r="2" />
      <circle cx="15.1" cy="12.2" r="2" />
      <circle cx="8.9" cy="12.2" r=".9" fill="currentColor" stroke="none" />
      <circle cx="15.1" cy="12.2" r=".9" fill="currentColor" stroke="none" />
      <path d="M10.6 15.5Q12 14.9 13.4 15.5L12 18.2z" fill="currentColor" stroke="none" />
    </>
  ),
  fox: (
    <>
      {/* On the kitty's face: big pointed ears, oval eyes, a pointed chin and
          a solid nose. No whiskers, which are the cat's */}
      <path d="M5.07 10.6 4.3 3.8l4.3 3.7a8 6 0 0 1 6.8 0l4.3-3.7-.77 6.8C18.9 15.4 15.5 18.2 12 19.6 8.5 18.2 5.1 15.4 5.07 10.6z" />
      <ellipse cx="9.2" cy="11.3" rx=".85" ry="1.15" fill="currentColor" stroke="none" />
      <ellipse cx="14.8" cy="11.3" rx=".85" ry="1.15" fill="currentColor" stroke="none" />
      <path d="M10.9 15.6h2.2L12 16.9z" fill="currentColor" stroke="none" />
    </>
  ),
  frog: (
    <>
      {/* The head stops at the eyes rather than running through them */}
      <path d="M5.75 9.1C4.4 10.2 3.5 12 3.5 14c0 3.3 3.8 5.5 8.5 5.5s8.5-2.2 8.5-5.5c0-2-.9-3.8-2.25-4.9M9.7 10q2.3-.6 4.6 0" />
      <circle cx="8" cy="8.3" r="2.4" />
      <circle cx="16" cy="8.3" r="2.4" />
      <circle cx="8" cy="8.3" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8.3" r="1" fill="currentColor" stroke="none" />
      <path d="M8.5 14.5q3.5 2.3 7 0" />
    </>
  ),
  bee: (
    <>
      {/* From above: a head, a striped body, a wing to each side. No feelers:
          they turned to fuzz at small sizes */}
      <ellipse cx="12" cy="14.5" rx="3.8" ry="5.2" />
      <circle cx="12" cy="7.3" r="2" />
      <path d="M8.3 12.8h7.4M8.45 16.6h7.1" />
      <path d="M8.6 12.2C6 13.6 2.9 12.2 3.4 9.9 3.9 7.8 7.2 8.2 9.4 10.4M15.4 12.2c2.6 1.4 5.7 0 5.2-2.3-.5-2.1-3.8-1.7-6 .5" />
    </>
  ),
  octopus: (
    <>
      <path d="M6 11.5a6 6 0 0 1 12 0v2H6z" />
      <path d="M7 13.5c0 3-2 4-2 6M10 13.5c0 3-1 5-.5 7M14 13.5c0 3 1 5 .5 7M17 13.5c0 3 2 4 2 6" />
      <circle cx="9.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  snail: (
    <>
      {/* The shell sits right on the foot; one open curl stands for the spiral,
          since a full one filled in at small sizes */}
      <path d="M2.5 18.5h14.5a2.5 2.5 0 0 0 2.5-2.5v-4.5a1.5 1.5 0 0 0-3 0V14" />
      <path d="M18 10 17.2 7M18 10l1.6-2.6" />
      <circle cx="9.5" cy="12.7" r="5.8" />
      <path d="M12.3 12.7a2.8 2.8 0 1 0-2.8 2.8" />
    </>
  ),
  tortoise: (
    <>
      {/* Side on, heading right: a tall domed shell, a head with an eye, two
          legs. No pattern on the shell: it filled in at small sizes */}
      <path d="M2.5 15.5a8 7 0 0 1 16 0z" />
      <path d="M18.3 11.6h2.5a1.8 1.8 0 0 1 0 3.6h-1.6" />
      <circle cx="20.8" cy="13.1" r=".55" fill="currentColor" stroke="none" />
      <path d="M7 15.5v2.6M14 15.5v2.6" />
    </>
  ),
  hare: (
    <>
      {/* The kitty's cousin on the very same face: her eyes, nose and
          whiskers, with two tall rounded ears reaching the top of the box */}
      <path d="M7.3 9.65C6.5 7.4 5.9 4.2 6.8 2.3Q8 .3 9.6 1.9C10.5 3.2 10.8 6.2 10.6 8.22A7.5 7 0 0 1 13.4 8.22C13.2 6.2 13.5 3.2 14.4 1.9Q16 .3 17.2 2.3C18.1 4.2 17.5 7.4 16.7 9.65A7.5 7 0 1 1 7.3 9.65z" />
      <ellipse cx="9.3" cy="14.6" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="14.7" cy="14.6" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="16.9" rx="1.15" ry=".85" fill="currentColor" stroke="none" />
      <path d="M6.51 16.1l-4.25-0.67M7.53 18.3l-4.21 0.89M17.49 16.1l4.25-0.67M16.47 18.3l4.21 0.89" />
    </>
  ),
  ghost: (
    <>
      <path d="M6 20.5V11a6 6 0 0 1 12 0v9.5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" />
      <circle cx="10" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <path d="M10.6 14c.8.6 2 .6 2.8 0" />
    </>
  ),
  tree: (
    <>
      <path d="M12 3l6 8.5h-3.5l4.5 6.5H5l4.5-6.5H6z" />
      <path d="M12 18v3" />
    </>
  ),
  cactus: (
    <path d="M10 21V5.5a2 2 0 0 1 4 0V21M10 13H8a2 2 0 0 1-2-2V8.5M14 11h2a2 2 0 0 0 2-2V6.5M7 21h10" />
  ),
  mushroom: (
    <>
      <path d="M4 12a8 8 0 0 1 16 0z" />
      <path d="M9.5 12v6.5a2.5 2.5 0 0 0 5 0V12" />
    </>
  ),
  cloud: (
    <path d="M7 18.5h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18.5z" />
  ),
  snowflake: (
    <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5" />
  ),
  flame: (
    <path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-4 3.5-6 4-10 3 1.5 4.5 4 4.5 6.5 1-.5 1.8-1.5 2-3 1.6 1.6 2.5 3.8 2.5 6.5 0 3.4-2.6 6-6.5 6z" />
  ),
  umbrella: (
    <>
      <path d="M3 12a9 9 0 0 1 18 0z" />
      <path d="M12 12v6.5a2 2 0 0 1-4 0M12 3v0" />
    </>
  ),
  anchor: (
    <>
      <circle cx="12" cy="5.5" r="2" />
      <path d="M12 7.5V21M8.5 11h7M4.5 13.5a7.5 7.5 0 0 0 15 0" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 2.5c3 2 4.5 5.5 4.5 9.5l-2 4.5h-5l-2-4.5c0-4 1.5-7.5 4.5-9.5z" />
      <path d="M9.5 16.5 7 19l.5-5.5M14.5 16.5 17 19l-.5-5.5M12 19v2.5" />
      <circle cx="12" cy="9.5" r="1.5" />
    </>
  ),
  bicycle: (
    <>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16l3.5-6.5h6L18 16M9.5 9.5 12 16H6M8 6.5h3M15.5 9.5l-1-3H17" />
    </>
  ),
  balloon: (
    <>
      <path d="M12 3a6.5 6.5 0 0 0-6.5 6.5c0 3.5 3.5 6 4.5 8h4c1-2 4.5-4.5 4.5-8A6.5 6.5 0 0 0 12 3z" />
      <path d="M12 3c-1.8 2-2.5 4.4-2.5 6.5s.4 5 .5 8M12 3c1.8 2 2.5 4.4 2.5 6.5s-.4 5-.5 8" />
      <path d="M10.3 17.5h3.4v3h-3.4z" />
    </>
  ),
  planet: (
    <>
      {/* The ring goes behind the planet: the part that would show through
          it is left out */}
      <circle cx="12" cy="12" r="5.5" />
      <path d="M15.47 7.73A10 3.2-20 1 1 6.6 10.96" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <path d="M4 15h3v5H5.5A1.5 1.5 0 0 1 4 18.5zM20 15h-3v5h1.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5L9 4.5h6L16.5 7H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18c1.2 0 2-.8 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2a4 4 0 0 0 4-4c0-4.2-4-7.5-9-7.5z" />
      <circle cx="7.5" cy="11.5" r="1" />
      <circle cx="10" cy="7.5" r="1" />
      <circle cx="14.5" cy="7.5" r="1" />
    </>
  ),
  pencil: <path d="M16.5 3.5l4 4L8 20H4v-4zM14 6l4 4" />,
  lightbulb: (
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.5 1 .5 1.6V16h6v-.5c0-.6.1-1.2.6-1.6A6 6 0 0 0 12 3z" />
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4.5" />
      <path d="M11.2 11.8 20 3M17 6l2.5 2.5M14.5 8.5l2 2" />
    </>
  ),
  crown: (
    <>
      <path d="M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10z" />
      <path d="M4.5 20.5h15" />
    </>
  ),
  chef: (
    <>
      {/* A toque: three tall puffs overhanging a narrow band. No pleats,
          and the puffs wider than the band, or it reads as a muffin */}
      <path d="M8.5 15.5C4.6 15.8 2.8 11.2 5.6 9.2c.9-.6 2-.8 2.9-.6C8.9 5.9 10.3 4 12 4s3.1 1.9 3.5 4.6c.9-.2 2 0 2.9.6 2.8 2 1 6.6-2.9 6.3" />
      <path d="M8.5 15.5v4h7v-4" />
    </>
  ),
  teapot: (
    <>
      {/* Side on: a round body, a lid with a knob, a spout up to the left
          and a handle to the right, none of them crossing */}
      <path d="M5.5 10.5h13c0 4.7-2.7 8.5-6.5 8.5s-6.5-3.8-6.5-8.5z" />
      <path d="M8 10.5a4 2.6 0 0 1 8 0" />
      <circle cx="12" cy="6.9" r="1.1" fill="currentColor" stroke="none" />
      <path d="M5.7 12.5 2.8 9.8c.4 2.7 1.8 5.2 4.25 6.2" />
      <path d="M18.4 12h.8a2.3 2.3 0 0 1 0 4.6h-2.7" />
    </>
  ),
  dice: (
    <>
      <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5z" />
      <circle cx="9" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
};

export type AvatarIcon = keyof typeof ICON_PATHS;

// What the picker offers, in its order. The rest of ICON_PATHS is retired
// for now: still drawn for anyone who chose one, no longer on offer.
export const AVATAR_ICONS: AvatarIcon[] = [
  "book",
  "bookmark",
  "leaf",
  "flower",
  "moon",
  "sun",
  "star",
  "mountain",
  "glasses",
  "cat",
  "hare",
  "paw",
  "owl",
  "frog",
  "octopus",
  "ghost",
  "tree",
  "cactus",
  "planet",
  "crown",
  "anchor",
  "music",
  "headphones",
  "bicycle",
  "umbrella",
];

export function isAvatarIcon(value: unknown): value is AvatarIcon {
  return typeof value === "string" && value in ICON_PATHS;
}

// Bookplates: initials in a serif inside a thin frame, like the ex libris
// label pasted inside a book's cover. Chosen ones are kept as "plate:" and
// a color; without a choice, a color is picked from the person's name.
export const PLATE_COLORS = {
  forest:
    "bg-forest-600/10 text-forest-700 dark:bg-forest-400/15 dark:text-forest-400",
  oxblood: "bg-red-900/10 text-red-900 dark:bg-red-400/15 dark:text-red-300",
  navy: "bg-blue-900/10 text-blue-900 dark:bg-blue-400/15 dark:text-blue-300",
  ochre:
    "bg-amber-600/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  plum: "bg-purple-900/10 text-purple-900 dark:bg-purple-400/15 dark:text-purple-300",
  ink: "bg-stone-900/10 text-stone-800 dark:bg-stone-100/10 dark:text-stone-200",
};
export type PlateColor = keyof typeof PLATE_COLORS;
export const PLATE = "plate:";

export const isPlateColor = (value: unknown): value is PlateColor =>
  typeof value === "string" && value in PLATE_COLORS;

// A stored picture, taken apart: an icon, or a bookplate (no icon), each
// with the color chosen for it, if any. "owl", "owl:plum", "plate:plum".
export function pictureOf(value: unknown): {
  icon: AvatarIcon | null;
  color: PlateColor | null;
} {
  if (typeof value !== "string") return { icon: null, color: null };
  const [head, tail] = value.split(":");
  const color = isPlateColor(tail) ? tail : null;
  if (head === PLATE.slice(0, -1)) return { icon: null, color };
  return isAvatarIcon(head)
    ? { icon: head, color }
    : { icon: null, color: null };
}

// Whether a value is one the picture picker could have stored
export function isPicture(value: unknown) {
  const { icon, color } = pictureOf(value);
  return icon !== null || color !== null;
}

// The chosen color from a stored picture, bookplate or icon
export function plateColorOf(value: unknown): PlateColor | null {
  return pictureOf(value).color;
}

// Someone who hasn't chosen keeps the same color, worked out from their
// name. Ink reads as grey, so it's there to choose but never handed out.
const DEFAULT_PLATES: PlateColor[] = [
  "forest",
  "oxblood",
  "navy",
  "ochre",
  "plum",
];

export function plateColorFor(
  firstname?: string | null,
  surname?: string | null,
): PlateColor {
  const name = `${firstname ?? ""} ${surname ?? ""}`;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return DEFAULT_PLATES[hash % DEFAULT_PLATES.length];
}

const initialsOf = (firstname?: string | null, surname?: string | null) =>
  `${(firstname?.[0] || "").toUpperCase()}${(surname?.[0] || "").toUpperCase()}`;

// A bookplate on its own, for the picker in Settings too
export function Bookplate({
  firstname,
  surname,
  color,
  box,
  framed,
  className = "",
}: {
  firstname?: string | null;
  surname?: string | null;
  color?: PlateColor | null;
  box: string;
  framed: boolean;
  className?: string;
}) {
  const tone = PLATE_COLORS[color ?? plateColorFor(firstname, surname)];
  // Letter spacing also trails the last letter, so the same space on the
  // left keeps the pair centered
  return (
    <span
      className={`${box} ${tone} relative flex flex-shrink-0 items-center justify-center rounded-full pl-[0.03em] font-serif font-semibold tracking-[0.03em] ${className}`}
    >
      {/* The frame: a thin ring inside the edge, at sizes where it shows */}
      {framed ? (
        <span
          aria-hidden="true"
          className="absolute inset-[3px] rounded-full border border-current opacity-30"
        />
      ) : null}
      {initialsOf(firstname, surname)}
    </span>
  );
}

export function AvatarGlyph({
  icon,
  size = 20,
}: {
  icon: AvatarIcon;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[icon]}
    </svg>
  );
}

// An icon's circle: the tint and ink of its chosen color, as a bookplate in
// that color has, or plain grey
export const iconTone = (color: PlateColor | null) =>
  color
    ? PLATE_COLORS[color]
    : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200";

const SIZES = {
  xs: { box: "w-6 h-6 text-[10px]", icon: 15 },
  sm: { box: "w-8 h-8 text-xs", icon: 20 },
  // A list beside other things, like the home page's friend activity
  list: { box: "w-9 h-9 text-xs", icon: 23 },
  md: { box: "w-10 h-10 text-sm", icon: 25 },
  lg: { box: "w-16 h-16 text-xl", icon: 38 },
};

export default function Avatar({
  firstname,
  surname,
  icon,
  size = "md",
  className = "",
}: {
  firstname?: string | null;
  surname?: string | null;
  icon?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { box, icon: iconSize } = SIZES[size];
  const picture = pictureOf(icon);
  if (!picture.icon) {
    return (
      <Bookplate
        firstname={firstname}
        surname={surname}
        color={picture.color}
        box={box}
        framed={size === "md" || size === "lg"}
        className={className}
      />
    );
  }
  return (
    <span
      className={`${box} rounded-full ${iconTone(picture.color)} font-semibold flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <AvatarGlyph icon={picture.icon} size={iconSize} />
    </span>
  );
}
