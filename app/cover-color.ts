// The color a cover is mostly made of, read from its loaded picture in
// the browser, so something beside it can wear it too. Covers come from
// this site's own /covers, so their pixels can be read.

export interface CoverColor {
  background: string;
  // Whether text on it should be light, for a dark color, or dark
  dark: boolean;
}

// Shrunk this small, a cover's colors average out into a few patches
const WIDTH = 24;
const HEIGHT = 36;

export function coverColor(img: HTMLImageElement): CoverColor | null {
  if (!img.complete || img.naturalWidth <= 1) return null;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  let pixels: Uint8ClampedArray;
  try {
    context.drawImage(img, 0, 0, WIDTH, HEIGHT);
    pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
  } catch {
    // A picture from somewhere else can't be read
    return null;
  }

  // Pixels grouped by their color, coarsely, and the biggest group's
  // average taken: the color most of the cover is, not a muddy mix of all
  const groups = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const group = groups.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    group.count += 1;
    group.r += r;
    group.g += g;
    group.b += b;
    groups.set(key, group);
  }
  let biggest = { count: 0, r: 0, g: 0, b: 0 };
  for (const group of groups.values()) {
    if (group.count > biggest.count) biggest = group;
  }
  if (!biggest.count) return null;
  const [r, g, b] = [biggest.r, biggest.g, biggest.b].map((sum) =>
    Math.round(sum / biggest.count),
  );

  // How light it looks: sRGB to linear light, weighted as the eye weighs it
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return { background: `rgb(${r} ${g} ${b})`, dark: luminance < 0.4 };
}
