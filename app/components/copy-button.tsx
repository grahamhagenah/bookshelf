import { useEffect, useRef, useState } from "react";

// Copies a value to the clipboard and says so for a moment. Both labels
// share one cell, so the button keeps its width while it says "Copied".
export default function CopyButton({
  value,
  className,
  label = "Copy",
}: {
  value: string;
  className: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the value is on screen to select
    }
  };

  return (
    <button type="button" onClick={copy} className={className}>
      <span className="grid justify-items-center" aria-live="polite">
        <span
          className={`col-start-1 row-start-1 ${copied ? "invisible" : ""}`}
        >
          {label}
        </span>
        <span
          className={`col-start-1 row-start-1 ${copied ? "" : "invisible"}`}
        >
          Copied
        </span>
      </span>
    </button>
  );
}
