import { crc32 } from "node:zlib";

import { renderToStaticMarkup } from "react-dom/server";

import { AVATAR_ICONS, ICON_PATHS, type AvatarIcon } from "~/components/avatar";

// The profile picture icons as files to edit elsewhere: one SVG each, in
// the line the app draws them with but a solid ink rather than the page's
// color, so they open looking right in any editor

const INK = "#1c1917";

export function iconSvg(icon: AvatarIcon) {
  const body = renderToStaticMarkup(<>{ICON_PATHS[icon]}</>).replaceAll(
    "currentColor",
    INK,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;
}

// Every icon: the ones on offer at the top, the retired ones (still drawn
// for anyone who chose one) in a folder of their own
export function iconFiles() {
  const offered = new Set<string>(AVATAR_ICONS);
  return (Object.keys(ICON_PATHS) as AvatarIcon[]).map((icon) => ({
    name: `${offered.has(icon) ? "" : "retired/"}${icon}.svg`,
    data: Buffer.from(iconSvg(icon)),
  }));
}

// A plain zip of the given files, stored rather than compressed: SVGs are
// small, and this needs nothing beyond Node
export function zip(files: { name: string; data: Buffer }[]) {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of files) {
    const fileName = Buffer.from(name);
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // names are UTF-8
    header.writeUInt16LE(0, 8); // stored
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(fileName.length, 26);
    local.push(header, fileName, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(fileName.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, fileName);

    offset += header.length + fileName.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
