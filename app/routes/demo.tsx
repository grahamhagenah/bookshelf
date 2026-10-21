import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import isBot from "isbot";

import {
  createDemoSandbox,
  deleteDemoGroup,
  getDemoGroup,
} from "~/models/demo.server";
import {
  createUserSession,
  getUserId,
  sessionStorage,
  getSession,
} from "~/session.server";

// Visiting /demo drops you straight into a populated sandbox library
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");

  // Link previews and crawlers shouldn't spin up sandboxes
  if (isBot(request.headers.get("user-agent"))) return redirect("/");

  const demoUserId = await createDemoSandbox();
  return createUserSession({
    request,
    userId: demoUserId,
    remember: false,
    redirectTo: "/",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  const userId = await getUserId(request);
  const demoGroup = userId ? await getDemoGroup(userId) : null;

  // Only demo sessions can be reset or ended here
  if (userId && !demoGroup) return redirect("/");

  if (demoGroup) await deleteDemoGroup(demoGroup);

  if (intent === "exit") {
    const session = await getSession(request);
    return redirect("/join", {
      headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
    });
  }

  // "start" and "reset" both hand out a fresh sandbox
  const demoUserId = await createDemoSandbox();
  return createUserSession({
    request,
    userId: demoUserId,
    remember: false,
    redirectTo: "/",
  });
};
