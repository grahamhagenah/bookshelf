
import { Form, useNavigation } from "react-router";

import { HONEYPOT_FIELD } from "~/utils";

// Starts a fresh demo sandbox. Shows that it's working, since setting one up
// can take a moment on a cold server: the label and "Setting up…" share one
// spot, so the button keeps its size and never wraps as it changes.
export default function DemoButton({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const navigation = useNavigation();
  const starting =
    navigation.state !== "idle" && navigation.formAction === "/demo";

  return (
    <Form action="/demo" method="post">
      {/* Hidden from people and screen readers; bots fill it in */}
      <input
        type="text"
        name={HONEYPOT_FIELD}
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      />
      <button
        type="submit"
        name="intent"
        value="start"
        disabled={starting}
        aria-busy={starting}
        className={`${className} ${starting ? "cursor-wait opacity-60" : ""}`}
      >
        <span className="inline-grid">
          <span className={`col-start-1 row-start-1 ${starting ? "invisible" : ""}`}>
            {children}
          </span>
          <span
            className={`col-start-1 row-start-1 whitespace-nowrap ${starting ? "" : "invisible"}`}
          >
            Setting up…
          </span>
        </span>
      </button>
    </Form>
  );
}
