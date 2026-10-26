// Finding friends from a pasted list of email addresses

// The most addresses one paste looks up
export const EMAILS_AT_ONCE = 20;

// Every address in what was pasted, however it's separated, including
// "Maya Chen <maya@example.com>" from an address book
export function emailsIn(text: string) {
  const found = text.match(/[^\s<>,;"'()]+@[^\s<>,;"'()]+\.[^\s<>,;"'()]+/g) ?? [];
  return [...new Set(found.map((email) => email.toLowerCase()))];
}
