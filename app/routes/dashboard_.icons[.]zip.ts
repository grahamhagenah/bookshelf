import type { LoaderFunctionArgs } from "react-router";

import { iconFiles, zip } from "~/icon-files.server";
import { isUserAdmin } from "~/models/user.server";
import { requireUserId } from "~/session.server";

// The profile picture icons as a zip of SVGs, for an admin to edit
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  if (!(await isUserAdmin(userId))) {
    throw new Response("Forbidden", { status: 403 });
  }
  return new Response(zip(iconFiles()), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="stacks-icons.zip"',
      "Cache-Control": "no-store",
    },
  });
};
