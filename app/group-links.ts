// Group links carry the group's name for people to read, ahead of the
// id or invite code that does the work: /g/thursday-book-club-7afb82a3…
// The name is never looked up, so renaming a group breaks no link.

// The longest a group's name can be
export const GROUP_NAME_MAX = 60;
export const GROUP_DESCRIPTION_MAX = 300;

// "Thursday Book Club!" -> "thursday-book-club"; "Café Lecture" -> "cafe-lecture"
export function slugify(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

const withName = (name: string, code: string) => {
  const slug = slugify(name);
  return slug ? `${slug}-${code}` : code;
};

// The link that lets someone join
export const groupInvitePath = (name: string, token: string) => `/g/${withName(name, token)}`;

// The message that goes with the link, ready to send
export const groupInviteText = (name: string, url: string) =>
  `Join ${name} on Stacks, so we can borrow each other's books: ${url}`;

// The group's own page
export const groupPath = (group: { id: string; name: string }) =>
  `/groups/${withName(group.name, group.id)}`;

// The id or invite code at the end of a link, whatever name is before it.
// Neither ever has a dash in it.
export const codeFromLink = (param: string) => param.slice(param.lastIndexOf("-") + 1);
