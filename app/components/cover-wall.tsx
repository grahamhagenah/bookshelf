// A wall of book covers behind the landing page. It's one pre-drawn
// image (public/cover-wall.webp, and @2x for sharp screens; rebuilt by
// scripts/cover-wall) rather than ~150 separate covers.

// The grid's size in CSS pixels
const WIDTH = 2032;
const HEIGHT = 1672;

export default function CoverWall() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="cover-wall absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-no-repeat"
        style={{ width: WIDTH, height: HEIGHT, backgroundSize: "100% 100%" }}
      />
      {/* An even wash so the covers stay in color but sit back behind the card */}
      <div className="absolute inset-0 bg-white/60 dark:bg-stone-950/60" />
    </div>
  );
}
