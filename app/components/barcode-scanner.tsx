import { useEffect, useRef, useState } from "react";

import type { ScanResponse } from "~/routes/api.scan";

// Point the phone at the barcode on the back of a book and it's added.
// The camera stays on, so a shelf can be done in one go. The decoder is
// loaded only when this opens, since it's a big library.

interface Scanned {
  isbn: string;
  state: "adding" | "added" | "already" | "missing" | "failed";
  title?: string;
}

const ISBN = /^(97[89]\d{10}|\d{9}[\dXx])$/;

export default function BarcodeScanner({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scans, setScans] = useState<Scanned[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  // The same barcode comes through many times a second while it's in view
  const lastRef = useRef<{ isbn: string; at: number }>({ isbn: "", at: 0 });

  const add = async (raw: string) => {
    const isbn = raw.replace(/[^0-9Xx]/g, "");
    if (!ISBN.test(isbn)) return;
    const now = Date.now();
    if (lastRef.current.isbn === isbn && now - lastRef.current.at < 4000) return;
    lastRef.current = { isbn, at: now };
    if (scans.some((scan) => scan.isbn === isbn)) return;

    setScans((list) => [{ isbn, state: "adding" }, ...list]);
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
                : { isbn, state: "missing" },
        ),
      );
    } catch {
      setScans((list) =>
        list.map((scan) => (scan.isbn === isbn ? { ...scan, state: "failed" } : scan)),
      );
    }
  };
  const addRef = useRef(add);
  addRef.current = add;

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (result) addRef.current(result.getText());
          },
        );
        stop = () => controls.stop();
        if (cancelled) controls.stop();
      } catch (error) {
        setCameraError(
          error instanceof Error && /permission|denied|notallowed/i.test(error.name + error.message)
            ? "Camera access was turned down. You can still type an ISBN below."
            : "No camera here. You can still type an ISBN below.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

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
          {added ? (
            <span className="ml-2 font-normal text-stone-400">
              {added} added
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-stone-600 hover:bg-stone-800 transition-colors"
        >
          Done
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-lg px-4">
        {cameraError ? (
          <p className="rounded-md bg-stone-900 px-4 py-6 text-center text-sm text-stone-300">
            {cameraError}
          </p>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-[4/3] w-full rounded-md bg-stone-900 object-cover"
            />
            {/* A frame to aim with */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-12 top-1/2 h-20 -translate-y-1/2 rounded-md border-2 border-white/60"
            />
          </>
        )}
        <p className="mt-2 text-center text-sm text-stone-400">
          Hold the barcode on the back of the book inside the frame.
        </p>
      </div>

      <form
        className="mx-auto mt-4 flex w-full max-w-lg gap-2 px-4"
        onSubmit={(event) => {
          event.preventDefault();
          add(manual);
          setManual("");
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder="Or type the ISBN"
          aria-label="ISBN"
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
                      : "Couldn't add"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
