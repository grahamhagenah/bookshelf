// @vitest-environment node
import { COVER_PATH, loadCover } from "./covers.server";

test("COVER_PATH allows only Open Library cover paths", () => {
  expect(COVER_PATH.test("b/isbn/9780547928227-M.jpg")).toBe(true);
  expect(COVER_PATH.test("b/id/12345-L.jpg")).toBe(true);
  expect(COVER_PATH.test("b/olid/OL123M-S.jpg")).toBe(true);

  expect(COVER_PATH.test("b/isbn/9780547928227-XL.jpg")).toBe(false);
  expect(COVER_PATH.test("a/olid/OL1A-M.jpg")).toBe(false);
  expect(COVER_PATH.test("b/isbn/../../etc/passwd-M.jpg")).toBe(false);
  expect(COVER_PATH.test("b/isbn/1-M.jpg?x=1")).toBe(false);
});

test("loadCover refuses other paths without going to the network", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  expect(await loadCover("../../secrets.txt")).toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
