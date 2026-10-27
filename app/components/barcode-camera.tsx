import { useEffect, useRef, useState } from "react";

// The camera, reading the barcodes on the backs of books: for adding them
// to a shelf, and for the check-out desk.
//
// Reading the barcode: the browser's own BarcodeDetector where it exists
// (Chrome and Android, fast and built in), otherwise @zxing/browser,
// loaded only when this opens. Either way only retail barcodes (EAN and
// UPC) are looked for, which keeps the decoder quick.

export type Phase = "starting" | "looking" | "found" | "nocamera";

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

// Starts the camera and calls onIsbn with each book's ISBN as it's read,
// once per book however long it stays in view. `read` takes one typed in
// the same way.
export function useBarcodeCamera(onIsbn: (isbn: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [note, setNote] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ on: boolean; track: MediaStreamTrack } | null>(null);
  const lastRef = useRef<{ isbn: string; at: number }>({ isbn: "", at: 0 });
  const onIsbnRef = useRef(onIsbn);
  onIsbnRef.current = onIsbn;

  const read = (raw: string) => {
    const isbn = raw.replace(/[^0-9Xx]/g, "");
    if (!ISBN.test(isbn)) return;
    const now = Date.now();
    if (lastRef.current.isbn === isbn && now - lastRef.current.at < SAME_CODE_MS) return;
    lastRef.current = { isbn, at: now };

    // Say so straight away, before whatever comes of it (unless there's
    // no camera to be looking through)
    setPhase((current) => (current === "nocamera" ? current : "found"));
    navigator.vibrate?.(60);
    setTimeout(() => setPhase((current) => (current === "found" ? "looking" : current)), 900);
    onIsbnRef.current(isbn);
  };
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    let stop: Stop | null = null;
    let stream: MediaStream | null = null;
    let canceled = false;
    (async () => {
      const video = videoRef.current;
      if (!video || !navigator.mediaDevices?.getUserMedia) {
        setPhase("nocamera");
        setNote("No camera here. You can still type an ISBN below.");
        return;
      }
      try {
        stream = await openCamera();
        if (canceled) return;
        const [track] = stream.getVideoTracks();
        const caps = track.getCapabilities?.() as { torch?: boolean } | undefined;
        if (caps?.torch) setTorch({ on: false, track });

        const onCode = (code: string) => readRef.current(code);
        stop = (await startNative(video, stream, onCode)) ?? (await startZxing(video, stream, onCode));
        if (canceled) stop();
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
      canceled = true;
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

  return { videoRef, phase, note, torch, toggleTorch, read };
}

// What the camera sees, with a frame to put the stripes in that goes
// green when one is read, and a line saying what it's doing. Light text,
// for a dark background.
export function CameraView({ camera }: { camera: ReturnType<typeof useBarcodeCamera> }) {
  const { videoRef, phase, note } = camera;
  const frameClass =
    phase === "found"
      ? "border-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.35)]"
      : "border-white/70";
  return (
    <>
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
          {/* Placed against the video alone, so nothing below can move it */}
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
        <p className="mt-1 min-h-8 text-center text-xs text-stone-500 dark:text-stone-400">
          Fill the frame with the black stripes (not the printed number), about a hand&apos;s width away, and hold still.
        </p>
      ) : null}
    </>
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
