import { useRef, useState } from "react";
import { useNavigate } from "react-router";

import { UPGRADE_PATH } from "~/plan";
import type { ScanResponse } from "~/routes/api.scan";

import { CameraView, useBarcodeCamera } from "./barcode-camera";

// Point the phone at the barcode on the back of a book and it's added.
// The camera stays on, so a shelf can be done in one go.

interface Scanned {
  isbn: string;
  state: "adding" | "added" | "already" | "missing" | "full" | "failed";
  title?: string;
}

// An ISBN typed in, rather than a title
const looksLikeIsbn = (text: string) => {
  const digits = text.replace(/[\s-]/g, "");
  return /^[0-9]{9}[0-9Xx]$|^[0-9]{13}$/.test(digits);
};

export default function BarcodeScanner({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scanned[]>([]);
  const [manual, setManual] = useState("");
  const scansRef = useRef<Scanned[]>([]);
  scansRef.current = scans;

  const add = async (isbn: string) => {
    // Once per book, unless Open Library didn't answer last time
    if (scansRef.current.some((scan) => scan.isbn === isbn && scan.state !== "failed")) return;

    setScans((list) => [{ isbn, state: "adding" }, ...list.filter((scan) => scan.isbn !== isbn)]);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        body: new URLSearchParams({ isbn }),
      });
      const data = (await res.json()) as ScanResponse;
      setScans((list) =>
        list.map((scan) =>
          scan.isbn !== isbn
            ? scan
            : "added" in data
              ? { isbn, state: "added", title: data.added.title }
              : "alreadyExists" in data
                ? { isbn, state: "already", title: data.title }
                : "limit" in data
                  ? { isbn, state: "full" }
                  : res.status === 404
                    ? { isbn, state: "missing" }
                    : { isbn, state: "failed" },
        ),
      );
    } catch {
      setScans((list) =>
        list.map((scan) => (scan.isbn === isbn ? { ...scan, state: "failed" } : scan)),
      );
    }
  };
  const camera = useBarcodeCamera(add);
  const { torch, toggleTorch } = camera;

  const added = scans.filter((scan) => scan.state === "added").length;
  return (
    <div
      role="dialog"
      aria-label="Scan a barcode"
      className="fixed inset-0 z-50 flex flex-col bg-stone-950 text-stone-100"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-semibold">
          Scan barcodes
          {added ? <span className="ml-2 font-normal text-stone-400">{added} added</span> : null}
        </p>
        <div className="flex items-center gap-2">
          {torch ? (
            <button
              type="button"
              onClick={toggleTorch}
              aria-pressed={torch.on}
              className={`rounded-md px-3 py-1.5 text-sm ring-1 ring-inset transition-colors ${
                torch.on ? "bg-stone-100 text-stone-900 ring-stone-100" : "ring-stone-600 hover:bg-stone-800"
              }`}
            >
              Light
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-stone-600 hover:bg-stone-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg px-4">
        <CameraView camera={camera} />
      </div>

      <form
        className="mx-auto mt-4 flex w-full max-w-lg gap-2 px-4"
        onSubmit={(event) => {
          event.preventDefault();
          const typed = manual.trim();
          if (!typed) return;
          // A book with no barcode (older ones have none): find it by title
          if (!looksLikeIsbn(typed)) {
            onClose();
            navigate(`/search?q=${encodeURIComponent(typed)}`);
            return;
          }
          camera.read(typed);
          setManual("");
        }}
      >
        <input
          type="text"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder="No barcode? Type the ISBN or the title"
          aria-label="ISBN or title"
          className="min-w-0 flex-1 rounded-md bg-stone-900 px-3 py-2 text-sm text-stone-100 ring-1 ring-inset ring-stone-700 placeholder:text-stone-500 focus:outline-none focus:ring-stone-400"
        />
        <button
          type="submit"
          className="rounded-md bg-stone-100 px-3 py-2 text-sm font-medium text-stone-900 hover:bg-white transition-colors"
        >
          Add
        </button>
      </form>

      <ul className="mx-auto mt-4 w-full max-w-lg flex-1 overflow-y-auto px-4 pb-6 text-sm">
        {scans.map((scan) => (
          <li
            key={scan.isbn}
            className="flex items-baseline justify-between gap-3 border-t border-stone-800 py-2"
          >
            <span className="min-w-0 truncate">
              {scan.title ?? <span className="font-mono text-stone-400">{scan.isbn}</span>}
            </span>
            <span className="flex-shrink-0 text-stone-400">
              {scan.state === "adding"
                ? "Looking up…"
                : scan.state === "added"
                  ? "Added"
                  : scan.state === "already"
                    ? "Already on your shelf"
                    : scan.state === "missing"
                      ? "Not on Open Library"
                      : scan.state === "full"
                        ? (
                          <a href={UPGRADE_PATH} className="text-stone-200 underline underline-offset-2">
                            Shelf full on the free plan
                          </a>
                        )
                        : "Open Library didn't answer. Scan it again"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
