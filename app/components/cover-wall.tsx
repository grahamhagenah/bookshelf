// A wall of book covers behind the landing page. It's one pre-drawn
// image (public/cover-wall.webp, rebuilt by scripts/cover-wall) rather than
// ~150 separate covers, so the page loads quickly.

// The grid's size in CSS pixels; the image is drawn a little larger
const WIDTH = 2032;
const HEIGHT = 1672;

export default function CoverWall() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-no-repeat"
        style={{
          width: WIDTH,
          height: HEIGHT,
          backgroundImage: "url(/cover-wall.webp)",
          backgroundSize: "100% 100%",
        }}
      />
    </div>
  );
}
