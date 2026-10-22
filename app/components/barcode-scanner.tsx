import { useEffect, useRef, useState } from "react";

import type { ScanResponse } from "~/routes/api.scan";

// Point the phone at the barcode on the back of a book and it's added.
// The camera stays on, so a shelf can be done in one go.
//
// Reading the barcode: the browser's own BarcodeDetector where it exists
// (Chrome and Android, fast and built in), otherwise @zxing/browser,
// loaded only when this opens. Either way only retail barcodes (EAN and
// UPC) are looked for, which keeps the decoder quick.

interface Scanned {
  isbn: string;
  state: "adding" | "added" | "already" | "missing" | "failed";
  title?: string;
}

type Phase = "starting" | "looking" | "found" | "nocamera";

const ISBN = /^(97[89]\d{10}|\d{9}[\dXx])$/;

// A barcode is read many times a second while it's in view
const SAME_CODE_MS = 4000;

// Stop the scanner this returns; it reads the video until then
type Stop = () => void;

async function startNative(
  video: HTMLVideoElement,
  stream: MediaStream,
  onCode: (code: string) => void,
): Promise<Stop | null> {
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (!Detector) return null;
  const supported = await Detector.getSupportedFormats?.();
  if (supported && !supported.includes("ean_13")) return null;
  const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });

  video.srcObject = stream;
  await video.play();
  let live = true;
  const tick = async () => {
    if (!live) return;
    try {
      if (video.readyState >= 2) {
        for (const code of await detector.detect(video)) {
          if (code.rawValue) onCode(code.rawValue);
        }
      }
    } catch {
      // A frame that couldn't be read; the next one will do
    }
    if (live) setTimeout(tick, 120);
  };
  tick();
  return () => {
    live = false;
  };
}

async function startZxing(
  video: HTMLVideoElement,
  stream: MediaStream,
  onCode: (code: string) => void,
): Promise<Stop> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80 });
  const controls = await reader.decodeFromStream(stream, video, (result) => {
    if (result) onCode(result.getText());
  });
  return () => controls.stop();
}

// The back camera, as sharp as it'll go: small barcodes need the pixels
async function openCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });
  const [track] = stream.getVideoTracks();
  try {
    // Keep refocusing as the phone moves between books
    await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
  } catch {
    // Not every camera takes focus settings
  }
  return stream;
}

export default function BarcodeScanner({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scans, setScans] = useState<Scanned[]>([]);
  const [phase, setPhase] = useState<Phase>("starting");
  const [note, setNote] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ on: boolean; track: MediaStreamTrack } | null>(null);
  const [manual, setManual] = useState("");
  const lastRef = useRef<{ isbn: string; at: number }>({ isbn: "", at: 0 });
  const scansRef = useRef<Scanned[]>([]);
  scansRef.current = scans;

  const add = async (raw: string) => {
    const isbn = raw.replace(/[^0-9Xx]/g, "");
    if (!ISBN.test(isbn)) return;
    const now = Date.now();
    if (lastRef.current.isbn === isbn && now - lastRef.current.at < SAME_CODE_MS) return;
    lastRef.current = { isbn, at: now };

    // Say so straight away, before the lookup (unless there's no camera
    // to be looking through)
    setPhase((current) => (current === "nocamera" ? current : "found"));
    navigator.vibrate?.(60);
    setTimeout(() => setPhase((current) => (current === "found" ? "looking" : current)), 900);
    if (scansRef.current.some((scan) => scan.isbn === isbn)) return;

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
    let stop: Stop | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      const video = videoRef.current;
      if (!video || !navigator.mediaDevices?.getUserMedia) {
        setPhase("nocamera");
        setNote("No camera here. You can still type an ISBN below.");
        return;
      }
      try {
        stream = await openCamera();
        if (cancelled) return;
        const [track] = stream.getVideoTracks();
        const caps = track.getCapabilities?.() as { torch?: boolean } | undefined;
        if (caps?.torch) setTorch({ on: false, track });

        const onCode = (code: string) => addRef.current(code);
        stop = (await startNative(video, stream, onCode)) ?? (await startZxing(video, stream, onCode));
        if (cancelled) stop();
        else setPhase("looking");
      } catch (error) {
        setPhase("nocamera");
        setNote(
          error instanceof Error && /permission|denied|notallowed/i.test(error.name + error.message)
            ? "Camera access was turned down. You can still type an ISBN below."
            : "The camera couldn't be started. You can still type an ISBN below.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const toggleTorch = async () => {
    if (!torch) return;
    try {
      await torch.track.applyConstraints({
        advanced: [{ torch: !torch.on } as MediaTrackConstraintSet],
      });
      setTorch({ ...torch, on: !torch.on });
    } catch {
      // Then it hasn't got one after all
    }
  };

  const added = scans.filter((scan) => scan.state === "added").length;
  const frameClass =
    phase === "found"
      ? "border-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.35)]"
      : "border-white/70";

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
        {phase === "nocamera" ? (
          <p className="rounded-md bg-stone-900 px-4 py-6 text-center text-sm text-stone-300">{note}</p>
        ) : (
          <div className="relative">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="aspect-[4/3] w-full rounded-md bg-stone-900 object-cover"
            />
            {/* The frame to put the stripes in; it goes green when one is
                read. It's placed against the video alone, so nothing
                below can move it. */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 transition-colors duration-150 ${frameClass}`}
            />
          </div>
        )}
        {/* Fixed heights, so the words can change without anything moving */}
        <p className="mt-2 flex h-5 items-center justify-center gap-2 text-center text-sm text-stone-400" aria-live="polite">
          {phase === "starting" ? (
            "Starting the camera…"
          ) : phase === "looking" ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-stone-400" aria-hidden="true" />
              Looking for a barcode
            </>
          ) : phase === "found" ? (
            <span className="font-medium text-emerald-300">Got it</span>
          ) : null}
        </p>
        {phase !== "nocamera" ? (
          <p className="mt-1 min-h-8 text-center text-xs text-stone-500">
            Fill the frame with the black stripes (not the printed number), about a hand&apos;s width away, and hold still.
          </p>
        ) : null}
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

// The browser's barcode API, where it exists; TypeScript doesn't know it
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorClass {
  new (options: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}
