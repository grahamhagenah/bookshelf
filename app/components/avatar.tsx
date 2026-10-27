// Profile pictures: a small set of line icons, or the person's initials as
// a bookplate.
// The chosen key is stored in User.profileEmoji (named before icons
// replaced emoji); anything that isn't a known key, such as an emoji
// picked earlier, falls back to initials.

const ICON_PATHS = {
  leaf: (
    <>
      <path d="M5 19c0-8.5 5.5-14 15-14 0 9.5-5.5 15-15 14z" />
      <path d="M5 19 14 10" />
    </>
  ),
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
      {/* Two peaks, the taller one capped in snow */}
      <path d="M2.5 19.5 9.5 7l4.1 7.3 2.4-3.8 5.5 8.8z" />
      <path d="M9.5 7 7.26 11 8.4 12.3l1.1-1.1 1.1 1.1 1.15-1.3z" fill="currentColor" />
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
      {/* Five petals in one outline over a solid center, on a short stem
          that ends where its two leaves meet, the leaves a clear gap below
          the petals, all centered in the box */}
      <g transform="translate(0 2.0)">
        <path d="M9.24 8.3A2.3 2.3 0 1 1 10.3 5.05A2.3 2.3 0 1 1 13.7 5.05A2.3 2.3 0 1 1 14.76 8.3A2.3 2.3 0 1 1 12 10.3A2.3 2.3 0 1 1 9.24 8.3z" />
        <circle cx="12" cy="7.4" r="1.15" fill="currentColor" stroke="none" />
        <path d="M12 12.9V18.7" />
        <path d="M12 18.7Q10.84 14.83 6.8 14.7Q7.96 18.57 12 18.7z" />
        <path d="M12 18.7Q16.04 18.57 17.2 14.7Q13.16 14.83 12 18.7z" />
      </g>
    </>
  ),
  bloom: (
    <>
      {/* A bloom seen from above: five round petals in one outline around a
          solid center, filling the box, no stem */}
      <path d="M8.39 13.17A3.0 3.0 0 1 1 9.77 8.93A3.0 3.0 0 1 1 14.23 8.93A3.0 3.0 0 1 1 15.61 13.17A3.0 3.0 0 1 1 12 15.8A3.0 3.0 0 1 1 8.39 13.17z" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
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
      {/* Four solid toes close over an open pad, the outer two turned out */}
      <ellipse cx="6.4" cy="11.3" rx="1.7" ry="2.15" transform="rotate(-25 6.4 11.3)" fill="currentColor" stroke="none" />
      <ellipse cx="9.6" cy="7.4" rx="1.7" ry="2.15" transform="rotate(-8 9.6 7.4)" fill="currentColor" stroke="none" />
      <ellipse cx="14.4" cy="7.4" rx="1.7" ry="2.15" transform="rotate(8 14.4 7.4)" fill="currentColor" stroke="none" />
      <ellipse cx="17.6" cy="11.3" rx="1.7" ry="2.15" transform="rotate(25 17.6 11.3)" fill="currentColor" stroke="none" />
      <path d="M12 12.3c-2.7 0-5.3 3-5.3 5.4 0 1.5 1.2 2.6 2.7 2.6 1.1 0 1.6-.6 2.6-.6s1.5.6 2.6.6c1.5 0 2.7-1.1 2.7-2.6 0-2.4-2.6-5.4-5.3-5.4z" />
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
      {/* On the kitty's face, the same size: two eye bumps rising out of
          the top of the head (the outline stops where they sit), pupils
          under them, and a wide smile */}
      <path d="M6.45 9.19A7.5 7 0 1 0 17.55 9.19M12.71 6.93A7.5 7 0 0 0 11.29 6.93" />
      <path d="M6.45 9.19A2.7 2.7 0 1 1 11.29 6.93M12.71 6.93A2.7 2.7 0 1 1 17.55 9.19" />
      <circle cx="8.7" cy="7.9" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.3" cy="7.9" r="1" fill="currentColor" stroke="none" />
      <path d="M8 15.8Q12 19 16 15.8" />
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
      {/* A jellyfish at the family's size: a bell as wide as the kitty's
          face with a scalloped hem, her oval eyes, and four tentacles */}
      <path d="M4.5 13.2C4.5 8.4 7.9 4.6 12 4.6s7.5 3.8 7.5 8.6Q16.3 14.6 12 14.6T4.5 13.2z" />
      <ellipse cx="9.3" cy="10.2" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="14.7" cy="10.2" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <path d="M7.2 14.5c-.9 2.1.7 3.6-.2 5.8M10.4 14.6c-.7 2.2.9 3.7.1 6.1M13.6 14.6c.7 2.2-.9 3.7-.1 6.1M16.8 14.5c.9 2.1-.7 3.6.2 5.8" />
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
  mouse: (
    <>
      {/* The mouse: bigger round ears up top, the kitty's whiskers, a small nose */}
      <ellipse cx="12" cy="13.9" rx="7.5" ry="7" />
      <path d="M6 9.7A3 3 0 1 1 9.4 7.33M14.6 7.33A3 3 0 1 1 18 9.7" />
      <ellipse cx="9.3" cy="13.4" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="14.7" cy="13.4" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="15.7" rx="1.15" ry="0.85" fill="currentColor" stroke="none" />
      <path d="M6.51 14.9l-4.25-0.67M7.53 17.1l-4.21 0.89M17.49 14.9l4.25-0.67M16.47 17.1l4.21 0.89" />
    </>
  ),
  koala: (
    <>
      {/* The koala: big round ears out at the sides, and a tall oval nose */}
      <ellipse cx="12" cy="13.9" rx="7.5" ry="7" />
      <path d="M5 11.4A3.2 3.2 0 1 1 8.2 7.87M15.8 7.87A3.2 3.2 0 1 1 19 11.4" />
      <ellipse cx="9.3" cy="12.6" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="14.7" cy="12.6" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="16" rx="1.5" ry="2" fill="currentColor" stroke="none" />
    </>
  ),
  ghost: (
    <>
      {/* At the family's size: a sheet as wide as the kitty's face, rounded
          on top with three scallops below, her oval eyes, and an "oh" */}
      <path d="M4.5 11.9C4.5 7.4 7.9 3.9 12 3.9s7.5 3.5 7.5 8v8.4c-1.25-1.15-2.5-1.15-3.75 0s-2.5 1.15-3.75 0-2.5-1.15-3.75 0-2.5 1.15-3.75 0z" />
      <ellipse cx="9.3" cy="11.4" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="14.7" cy="11.4" rx="1.05" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="15.2" rx=".9" ry="1.2" fill="currentColor" stroke="none" />
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
    <>
      {/* Six arms, each with a branch near its tip */}
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
      <path d="M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5M4.25 10.42L6.8 9L6.75 6.08M19.75 13.58L17.2 15L17.25 17.92M6.75 17.92L6.8 15L4.25 13.58M17.25 6.08L17.2 9L19.75 10.42" />
    </>
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
  discoball: (
    <>
      {/* A disco ball: a ball on a thread, with a sparse grid of facets */}
      <circle cx="12" cy="13.2" r="8" />
      <path d="M12 5.2V2" />
      <path d="M4.81 9.7h14.39M4.81 16.7h14.39M8.5 6.01v14.39M15.5 6.01v14.39" />
    </>
  ),
  skull: (
    <>
      {/* A skull: the cranium narrowing to a jaw, two sockets, a soft
          point-up nose and two teeth */}
      <path d="M4.5 11.5C4.5 6.5 7.9 3.5 12 3.5s7.5 3 7.5 8c0 3-1.3 4.9-3 5.8V21h-9v-3.7c-1.7-.9-3-2.8-3-5.8z" />
      <ellipse cx="9" cy="11.6" rx="2" ry="2.2" fill="currentColor" stroke="none" />
      <ellipse cx="15" cy="11.6" rx="2" ry="2.2" fill="currentColor" stroke="none" />
      <path d="M11.1 15.9h1.8L12 14.3z" fill="currentColor" />
      <path d="M10.5 18v3M13.5 18v3" />
    </>
  ),
  eye: (
    <>
      {/* An eye: the almond, the iris and the pupil */}
      <path d="M2.5 12C5 7 8.5 5 12 5s7 2 9.5 7c-2.5 5-6 7-9.5 7S5 17 2.5 12z" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  pyramid: (
    <>
      {/* A pyramid seen from a corner: two faces meeting at an edge, over a
          base in perspective */}
      <path d="M12 3L2.8 16.8L12.8 21L21.2 14.8z" />
      <path d="M12 3L12.8 21" />
    </>
  ),
  robot: (
    <>
      {/* A robot, kept simple: a rounded square head, an antenna with a ball
          on top, two square eyes and a straight mouth */}
      <rect x="4.5" y="6.5" width="15" height="13.5" rx="3" />
      <path d="M12 6.5V4.3" />
      <circle cx="12" cy="2.9" r="1.4" />
      <rect x="7.4" y="10.9" width="3" height="3" rx=".7" fill="currentColor" stroke="none" />
      <rect x="13.6" y="10.9" width="3" height="3" rx=".7" fill="currentColor" stroke="none" />
      <path d="M9 16.6h6" />
    </>
  ),
  mask: (
    <>
      {/* A hockey mask: a tall oval with two eye slits and four vent holes */}
      <circle cx="12" cy="13.6" r=".65" fill="currentColor" stroke="none" />
      <path d="M12 2.5C7.6 2.5 4.5 6.2 4.5 11.5c0 5.6 3.5 10 7.5 10s7.5-4.4 7.5-10C19.5 6.2 16.4 2.5 12 2.5z" />
      <ellipse cx="8.9" cy="9.8" rx="1.7" ry="1.1" fill="currentColor" stroke="none" />
      <ellipse cx="15.1" cy="9.8" rx="1.7" ry="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="15.8" r=".65" fill="currentColor" stroke="none" />
      <path d="M12 2.5C7.6 2.5 4.5 6.2 4.5 11.5c0 5.6 3.5 10 7.5 10s7.5-4.4 7.5-10C19.5 6.2 16.4 2.5 12 2.5z" />
      <ellipse cx="8.9" cy="9.8" rx="1.7" ry="1.1" fill="currentColor" stroke="none" />
      <ellipse cx="15.1" cy="9.8" rx="1.7" ry="1.1" fill="currentColor" stroke="none" />
      <circle cx="13.8" cy="15.8" r=".65" fill="currentColor" stroke="none" />
      <path d="M12 2.5C7.6 2.5 4.5 6.2 4.5 11.5c0 5.6 3.5 10 7.5 10s7.5-4.4 7.5-10C19.5 6.2 16.4 2.5 12 2.5z" />
      <ellipse cx="8.9" cy="9.8" rx="1.7" ry="1.1" fill="currentColor" stroke="none" />
      <ellipse cx="15.1" cy="9.8" rx="1.7" ry="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r=".65" fill="currentColor" stroke="none" />
    </>
  ),
  hearts: (
    <>
      {/* Two hearts of one size, one upper left behind one lower right: the
          back one is drawn only where the front one doesn't cover it */}
      <path d="M15.4 19.97C11.9 17.17 9.45 14.93 9.45 12.06C9.45 10.1 10.92 8.63 12.74 8.63C13.86 8.63 14.84 9.19 15.4 10.03C15.96 9.19 16.94 8.63 18.06 8.63C19.88 8.63 21.35 10.1 21.35 12.06C21.35 14.93 18.9 17.17 15.4 19.97z" />
      <path d="M8.97 15.07L8.6 15.37L8.23 15.07L7.87 14.78L7.51 14.49L7.17 14.2L6.83 13.92L6.51 13.64L6.19 13.36L5.89 13.08L5.6 12.8L5.32 12.53L5.05 12.26L4.79 11.98L4.54 11.71L4.31 11.44L4.09 11.17L3.89 10.9L3.7 10.62L3.52 10.35L3.36 10.07L3.22 9.79L3.09 9.51L2.97 9.23L2.88 8.94L2.8 8.65L2.73 8.36L2.69 8.07L2.66 7.77L2.65 7.46L2.66 7.25L2.67 7.05L2.7 6.85L2.74 6.65L2.78 6.46L2.84 6.28L2.91 6.1L2.98 5.92L3.07 5.75L3.16 5.59L3.26 5.44L3.37 5.29L3.49 5.14L3.61 5.01L3.74 4.88L3.88 4.76L4.02 4.65L4.17 4.55L4.33 4.45L4.49 4.37L4.66 4.29L4.83 4.22L5 4.17L5.18 4.12L5.37 4.08L5.56 4.05L5.75 4.04L5.94 4.03L6.06 4.03L6.18 4.04L6.29 4.05L6.41 4.06L6.53 4.08L6.64 4.1L6.75 4.13L6.86 4.16L6.97 4.19L7.07 4.23L7.18 4.27L7.28 4.32L7.38 4.36L7.48 4.41L7.58 4.47L7.67 4.53L7.76 4.59L7.85 4.65L7.94 4.72L8.02 4.79L8.11 4.86L8.18 4.93L8.26 5.01L8.34 5.09L8.41 5.17L8.47 5.25L8.54 5.34L8.6 5.43L8.66 5.34L8.73 5.25L8.79 5.17L8.86 5.09L8.94 5.01L9.02 4.93L9.09 4.86L9.18 4.79L9.26 4.72L9.35 4.65L9.44 4.59L9.53 4.53L9.62 4.47L9.72 4.41L9.82 4.36L9.92 4.32L10.02 4.27L10.13 4.23L10.23 4.19L10.34 4.16L10.45 4.13L10.56 4.1L10.67 4.08L10.79 4.06L10.91 4.05L11.02 4.04L11.14 4.03L11.26 4.03L11.45 4.04L11.64 4.05L11.83 4.08L12.02 4.12L12.2 4.17L12.37 4.22L12.54 4.29L12.71 4.37L12.87 4.45L13.03 4.55L13.18 4.65L13.32 4.76L13.46 4.88L13.59 5.01L13.71 5.14L13.83 5.29L13.94 5.44L14.04 5.59L14.13 5.75L14.22 5.92L14.29 6.1L14.36 6.28L14.42 6.46L14.46 6.65L14.5 6.85L14.53 7.05L14.54 7.25L14.55 7.46L14.54 7.77L14.51 8.07" />
    </>
  ),
  cutlery: (
    <>
      {/* A fork and a table knife, side by side */}
      <path d="M5 3v5.2a3 3 0 0 0 6 0V3M8 3v5.2M8 11.2V21" />
      <path d="M15.5 13.6V3C18 4.6 18.8 8.4 18.7 11.4c0 1.3-1.3 2.2-3.2 2.2M15.5 13.6V21" />
    </>
  ),
  vhs: (
    <>
      {/* A VHS tape: the cassette, two reels joined by the tape window, and
          the label strip */}
      <rect x="2.5" y="5.5" width="19" height="13" rx="1.6" />
      <circle cx="8" cy="11" r="2.2" />
      <circle cx="16" cy="11" r="2.2" />
      <path d="M8 8.8h8M8 13.2h8" />
      <path d="M5.5 16.2h13" />
    </>
  ),
  cassette: (
    <>
      {/* A cassette tape: two reels joined by the tape, and the notch for
          the tape head along the bottom */}
      <rect x="2.5" y="5" width="19" height="14" rx="1.8" />
      <circle cx="8.5" cy="10.5" r="2.2" />
      <circle cx="15.5" cy="10.5" r="2.2" />
      <path d="M8.5 8.3h7M8.5 12.7h7" />
      <path d="M7 19l1.4-3h7.2l1.4 3" />
    </>
  ),
  diamond: (
    <>
      {/* A cut diamond: the crown over the girdle, facets down to the point */}
      <path d="M6 4h12l4.5 5.5L12 21L1.5 9.5z" />
      <path d="M1.5 9.5h21M6 4l3.2 5.5L12 4l2.8 5.5L18 4M9.2 9.5L12 21l2.8-11.5" />
    </>
  ),
  wine: (
    <>
      {/* A wine glass: a bowl with a flat rim on a stem and a foot, with wine
          in it */}
      <path d="M6.5 3h11v5c0 3.7-2.5 6.6-5.5 6.6S6.5 11.7 6.5 8z" />
      <path d="M12 14.6V21M8 21h8" />
      <path d="M6.9 9.8h10.2c-.5 2.9-2.6 4.8-5.1 4.8S7.4 12.7 6.9 9.8z" fill="currentColor" stroke="none" />
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
  clover: (
    <>
      {/* A four-leaf clover: four small hearts meeting at their points, and a
          stem down between the lower two */}
      <path d="M10.85 10.25C8.11 10.55 6.07 10.64 4.83 9.4C3.97 8.54 3.97 7.27 4.77 6.48C5.25 5.99 5.92 5.81 6.53 5.93C6.41 5.32 6.59 4.65 7.08 4.17C7.87 3.37 9.14 3.37 10 4.23C11.24 5.47 11.15 7.51 10.85 10.25zM11.55 10.25C11.25 7.51 11.16 5.47 12.4 4.23C13.26 3.37 14.53 3.37 15.32 4.17C15.81 4.65 15.99 5.32 15.87 5.93C16.48 5.81 17.15 5.99 17.63 6.48C18.43 7.27 18.43 8.54 17.57 9.4C16.33 10.64 14.29 10.55 11.55 10.25zM11.55 10.95C14.29 10.65 16.33 10.56 17.57 11.8C18.43 12.66 18.43 13.93 17.63 14.72C17.15 15.21 16.48 15.39 15.87 15.27C15.99 15.88 15.81 16.55 15.32 17.03C14.53 17.83 13.26 17.83 12.4 16.97C11.16 15.73 11.25 13.69 11.55 10.95zM10.85 10.95C11.15 13.69 11.24 15.73 10 16.97C9.14 17.83 7.87 17.83 7.08 17.03C6.59 16.55 6.41 15.88 6.53 15.27C5.92 15.39 5.25 15.21 4.77 14.72C3.97 13.93 3.97 12.66 4.83 11.8C6.07 10.56 8.11 10.65 10.85 10.95z" />
      <path d="M11.2 11.7v5c0 1.9.8 3.4 2.4 4.6" />
    </>
  ),
  crystal: (
    <>
      {/* A crystal ball: a glint and one sparkle inside, seated in its
          stand, whose sides rise to meet the ball */}
      <circle cx="12" cy="9.6" r="6.8" />
      <path d="M8.1 7.1a4.4 4.4 0 0 1 2.3-2.3" />
      <path d="M12.6 7.2C13.1 9.5 13.1 9.5 15.4 10C13.1 10.5 13.1 10.5 12.6 12.8C12.1 10.5 12.1 10.5 9.8 10C12.1 9.5 12.1 9.5 12.6 7.2z" fill="currentColor" />
      <path d="M8.62 15.5L7 20.5h10l-1.62 -5" />
    </>
  ),
  plane: (
    <>
      {/* A paper plane */}
      <path d="M21.5 2.5 2.5 10.2l7.2 2.9 2.9 7.4z" />
      <path d="M21.5 2.5 9.7 13.1" />
    </>
  ),
  sparkles: (
    <>
      {/* Sparkles: a big four-point star and a small one */}
      <path d="M10 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5z" />
      <path d="M17.5 14c.3 1.9 1.3 2.9 3.2 3.2-1.9.3-2.9 1.3-3.2 3.2-.3-1.9-1.3-2.9-3.2-3.2 1.9-.3 2.9-1.3 3.2-3.2z" />
    </>
  ),
  peace: (
    <>
      {/* A peace sign */}
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17M12 12l-6 6M12 12l6 6" />
    </>
  ),
  yinyang: (
    <>
      {/* Yin and yang: one half filled, a dot of each in the other
          (the filled half has a hole, by fill-rule) */}
      <circle cx="12" cy="12" r="8.5" />
      <path fillRule="evenodd" d="M12 3.5a8.5 8.5 0 0 1 0 17a4.25 4.25 0 0 1 0-8.5a4.25 4.25 0 0 0 0-8.5zM10.9 16.25a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.75" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  smiley: (
    <>
      {/* A smiley face with a big open grin */}
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="9.2" cy="9.4" rx="1" ry="1.35" fill="currentColor" stroke="none" />
      <ellipse cx="14.8" cy="9.4" rx="1" ry="1.35" fill="currentColor" stroke="none" />
      <path d="M7.9 13.1h8.2c-.5 2.7-2.1 4.2-4.1 4.2s-3.6-1.5-4.1-4.2z" fill="currentColor" />
    </>
  ),
  pumpkin: (
    <>
      {/* A jack-o'-lantern: a round pumpkin with an outlined stem (the pumpkin's
          top closes it), two triangle eyes and a grin. The filled shapes keep the outline's rounded stroke, so
          their corners are soft like the rest of the set */}
      <path d="M12 7C8.4 5.8 4 8.2 4 13.8 4 18.3 7.4 21 12 21s8-2.7 8-7.2C20 8.2 15.6 5.8 12 7z" />
      <path d="M10.6 6.6c-.1-1.9.5-3.4 1.9-4.3.5-.3 1.2-.1 1.5.4.3.5.2 1.1-.2 1.4-.8.6-1.2 1.5-1.2 2.7" />
      <path d="M8.23 12.38 9.58 10.43l1.21 1.95zM13.22 12.38l1.2-1.95 1.36 1.95z" fill="currentColor" />
      <path d="M8.3 15.6h7.4c-.7 1.7-2 2.6-3.7 2.6s-3-.9-3.7-2.6z" fill="currentColor" />
    </>
  ),
  alien: (
    <>
      {/* An alien: a head narrowing to the chin, two big slanted eyes, a
          small mouth */}
      <path d="M12 3.5c-4.4 0-7.5 3-7.5 7.2 0 4.6 3.8 9.8 7.5 9.8s7.5-5.2 7.5-9.8C19.5 6.5 16.4 3.5 12 3.5z" />
      <ellipse cx="8.9" cy="11.4" rx="2.5" ry="1.45" transform="rotate(32 8.9 11.4)" fill="currentColor" stroke="none" />
      <ellipse cx="15.1" cy="11.4" rx="2.5" ry="1.45" transform="rotate(-32 15.1 11.4)" fill="currentColor" stroke="none" />
      <path d="M11 16.8h2" />
    </>
  ),
  icecream: (
    <>
      {/* An ice cream cone: a scoop with a dripping edge on a waffle cone */}
      <path d="M6.2 11C5.8 7 8.6 4 12 4s6.2 3 5.8 7c-1 .6-1.9.6-2.9 0s-1.9-.6-2.9 0-1.9.6-2.9 0-1.9-.6-2.9 0z" />
      <path d="M7.4 12.4 12 21l4.6-8.6M9.4 14.4l4.4-2M10.8 17.3l3.2-1.5" />
    </>
  ),
  vinyl: (
    <>
      {/* A vinyl record: the disc, its label and hole, and a shine */}
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none" />
      <path d="M12 5.8a6.2 6.2 0 0 1 6.2 6.2" />
    </>
  ),
  rainbow: (
    <>
      {/* A rainbow: two arcs, each end resting on a cloud. A third arc
          blurred together at small sizes */}
      <path d="M3.5 14.9a8.5 8.5 0 0 1 17 0M6.75 13.06a5.6 5.6 0 0 1 10.5 0" />
      <path d="M3.5 18.3a1.7 1.7 0 0 1 .43-3.35 2.3 2.3 0 0 1 4.57.2 1.6 1.6 0 0 1 .4 3.15z" />
      <path d="M20.5 18.3a1.7 1.7 0 0 0-.43-3.35 2.3 2.3 0 0 0-4.57.2 1.6 1.6 0 0 0-.4 3.15z" />
    </>
  ),
  bolt: (
    <>
      {/* A lightning bolt */}
      <path d="M13.5 2.5 5 13.5h6l-1.5 8 8.5-11h-6z" />
    </>
  ),
  butterfly: (
    <>
      {/* A butterfly from above: two wings a side, a body and feelers */}
      <path d="M12 11C10 6.5 6.5 4 4.3 4.8 2.6 5.4 3.2 9.6 6.5 11.3 8.3 12.2 10.4 12 12 11zM12 11c2-4.5 5.5-7 7.7-6.2 1.7.6 1.1 4.8-2.2 6.5-1.8.9-3.9.7-5.5-.3z" />
      <path d="M12 12.4c-1.8.4-4.3 1.2-5.3 3.3-.9 1.9.6 3.6 2.4 3 1.7-.6 2.6-3.3 2.9-6.3zM12 12.4c1.8.4 4.3 1.2 5.3 3.3.9 1.9-.6 3.6-2.4 3-1.7-.6-2.6-3.3-2.9-6.3z" />
      <path d="M12 8.6v10M12 8.6 10.6 5.8M12 8.6l1.4-2.8" />
    </>
  ),
  controller: (
    <>
      {/* A game controller: the pad, a cross of buttons and two round ones */}
      <path d="M7.5 8h9c2.6 0 4 2.2 4.4 5.2l.6 4c.3 2.2-1.9 3.4-3.4 1.8L16 16.8H8L5.9 19c-1.5 1.6-3.7.4-3.4-1.8l.6-4C3.5 10.2 4.9 8 7.5 8z" />
      <path d="M7.5 11.2v3M6 12.7h3" />
      <circle cx="15.7" cy="11.6" r=".85" fill="currentColor" stroke="none" />
      <circle cx="17.4" cy="13.6" r=".85" fill="currentColor" stroke="none" />
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
      {/* The ring goes behind the globe: the part that would show through
          it is left out. A slight tilt and a flat ellipse keep the ring
          around the globe's middle */}
      <circle cx="12" cy="12" r="5.5" />
      <path d="M16.56 8.91A10 2.6 -10 1 1 6.67 10.66" />
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
      {/* A toque: three tall puffs overhanging a narrow band, with two folds
          in the puff. The puffs wider than the band, or it reads as a muffin */}
      <path d="M8.5 15.5C4.6 15.8 2.8 11.2 5.6 9.2c.9-.6 2-.8 2.9-.6C8.9 5.9 10.3 4 12 4s3.1 1.9 3.5 4.6c.9-.2 2 0 2.9.6 2.8 2 1 6.6-2.9 6.3" />
      <path d="M8.5 15.5v4h7v-4" />
      <path d="M10.4 15.3V11.6M13.6 15.3V11.6" />
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
};

export type AvatarIcon = keyof typeof ICON_PATHS;

// What the picker offers, grouped so like pictures sit together. The rest of
// ICON_PATHS is retired for now: still drawn for anyone who chose one, no
// longer on offer.
export const AVATAR_ICONS: AvatarIcon[] = [
  // Nature and sky
  "leaf",
  "clover",
  "flower",
  "bloom",
  "tree",
  "cactus",
  "mountain",
  "sun",
  "moon",
  "star",
  "snowflake",
  "rainbow",
  "bolt",
  "planet",
  // Creatures
  "cat",
  "hare",
  "mouse",
  "koala",
  "frog",
  "octopus",
  "bee",
  "butterfly",
  "paw",
  // Spooky, and characters
  "ghost",
  "skull",
  "mask",
  "pumpkin",
  "crystal",
  "robot",
  "alien",
  // To wear and to use
  "glasses",
  "crown",
  "chef",
  "umbrella",
  "anchor",
  "bicycle",
  "plane",
  // Food and drink
  "wine",
  "cutlery",
  "icecream",
  // Music and fun
  "music",
  "vinyl",
  "headphones",
  "discoball",
  "cassette",
  "controller",
  // Shapes and symbols
  "hearts",
  "diamond",
  "pyramid",
  "eye",
  "sparkles",
  "peace",
  "yinyang",
  "smiley",
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
      strokeWidth="1.3"
      // The drawing a shade lighter than its circle's color, so the line
      // reads light; the circle itself keeps the color
      opacity={0.7}
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
    : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300";

// The picture fills about three quarters of its circle: the drawings are
// round-ish and keep clear of the box's corners, so they can run big
const SIZES = {
  xs: { box: "w-6 h-6 text-[10px]", icon: 19 },
  sm: { box: "w-8 h-8 text-xs", icon: 25 },
  // A list beside other things, like the friends page
  list: { box: "w-9 h-9 text-xs", icon: 28 },
  // The home page's side column: a step smaller, so the books lead
  rail: { box: "w-7 h-7 text-[11px]", icon: 22 },
  md: { box: "w-10 h-10 text-sm", icon: 31 },
  lg: { box: "w-16 h-16 text-xl", icon: 50 },
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
