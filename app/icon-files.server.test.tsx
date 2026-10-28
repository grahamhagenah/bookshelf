// @vitest-environment node
import { AVATAR_ICONS, ICON_PATHS } from "~/components/avatar";

import { iconFiles, iconSvg, zip } from "./icon-files.server";

test("each icon is a standalone SVG in a solid ink", () => {
  const svg = iconSvg("raven");
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  expect(svg).not.toContain("currentColor");
  expect(svg).toContain("<path");
});

test("the zip holds every icon, the retired ones in their own folder", () => {
  const files = iconFiles();
  expect(files).toHaveLength(Object.keys(ICON_PATHS).length);
  expect(files.filter((f) => !f.name.startsWith("retired/"))).toHaveLength(AVATAR_ICONS.length);

  const archive = zip(files);
  // Starts with a file, ends with the directory's closing record, which
  // counts them all
  expect(archive.readUInt32LE(0)).toBe(0x04034b50);
  const end = archive.subarray(archive.length - 22);
  expect(end.readUInt32LE(0)).toBe(0x06054b50);
  expect(end.readUInt16LE(10)).toBe(files.length);
});
