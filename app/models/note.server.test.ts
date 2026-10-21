// @vitest-environment node
import { makeBook, makeUser } from "../../test/db";

import { lendBook, returnBook } from "./book.server";
import {
  canLeaveNote,
  getLoveCounts,
  getReaderNotes,
  NOTE_MAX_LENGTH,
  saveReaderNote,
} from "./note.server";

describe("canLeaveNote", () => {
  test("the owner, the borrower and past borrowers can; others can't", async () => {
    const owner = await makeUser("Owner");
    const past = await makeUser("Past");
    const current = await makeUser("Current");
    const stranger = await makeUser("Stranger");
    const book = await makeBook(owner.id);

    await lendBook(book.id, past.id);
    await returnBook(book.id);
    await lendBook(book.id, current.id);
    const lent = { id: book.id, userId: owner.id, borrowerId: current.id };

    expect(await canLeaveNote(owner.id, lent)).toBe(true);
    expect(await canLeaveNote(current.id, lent)).toBe(true);
    expect(await canLeaveNote(past.id, lent)).toBe(true);
    expect(await canLeaveNote(stranger.id, lent)).toBe(false);
  });
});

describe("saveReaderNote", () => {
  test("keeps one note per reader, updating the heart and words separately", async () => {
    const owner = await makeUser("Owner");
    const book = await makeBook(owner.id);

    await saveReaderNote(owner.id, book.id, { loved: true });
    await saveReaderNote(owner.id, book.id, { body: "  Read the appendices!  " });
    // Saving words leaves the heart alone
    let [note] = await getReaderNotes(book.id);
    expect(note).toMatchObject({ loved: true, body: "Read the appendices!" });

    await saveReaderNote(owner.id, book.id, { loved: false });
    [note] = await getReaderNotes(book.id);
    expect(note).toMatchObject({ loved: false, body: "Read the appendices!" });
    expect(await getReaderNotes(book.id)).toHaveLength(1);
  });

  test("trims long notes and treats blank ones as no note", async () => {
    const owner = await makeUser("Owner");
    const book = await makeBook(owner.id);

    const long = await saveReaderNote(owner.id, book.id, {
      body: "x".repeat(NOTE_MAX_LENGTH + 50),
    });
    expect(long.body).toHaveLength(NOTE_MAX_LENGTH);

    const blank = await saveReaderNote(owner.id, book.id, { body: "   " });
    expect(blank.body).toBeNull();
  });
});

test("getLoveCounts counts only hearts", async () => {
  const owner = await makeUser("Owner");
  const friend = await makeUser("Friend");
  const loved = await makeBook(owner.id, "Loved");
  const notedOnly = await makeBook(owner.id, "Noted");

  await saveReaderNote(owner.id, loved.id, { loved: true });
  await saveReaderNote(friend.id, loved.id, { loved: true, body: "Yes" });
  await saveReaderNote(friend.id, notedOnly.id, { body: "Words, no heart" });

  const counts = await getLoveCounts([loved.id, notedOnly.id]);
  expect(counts.get(loved.id)).toBe(2);
  expect(counts.has(notedOnly.id)).toBe(false);
});
