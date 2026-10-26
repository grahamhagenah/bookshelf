import type { Params } from "react-router";
import invariant from "tiny-invariant";

import { codeFromLink } from "~/group-links";
import { getGroup } from "~/models/group.server";
import { requireUserId } from "~/session.server";

// Every tab of a group's page starts here: you, and the group, if you're
// in it
export async function loadGroup(request: Request, params: Params) {
  const userId = await requireUserId(request);
  invariant(params.groupId, "groupId not found");
  const group = await getGroup(codeFromLink(params.groupId), userId);
  if (!group) throw new Response("Not Found", { status: 404 });
  return { userId, group };
}
