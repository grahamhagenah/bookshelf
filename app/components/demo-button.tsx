import { Form, useNavigation } from "@remix-run/react";

// Starts a fresh demo sandbox. Shows that it's working, since setting one up
// can take a moment on a cold server.
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
      <button
        type="submit"
        name="intent"
        value="start"
        disabled={starting}
        className={`${className} ${starting ? "cursor-wait opacity-60" : ""}`}
      >
        {starting ? "Setting up your demo…" : children}
      </button>
    </Form>
  );
}
