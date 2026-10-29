import type { LoaderFunctionArgs } from "react-router";

import { prisma } from "~/db.server";
import { groupPath, slugify } from "~/group-links";
import { loadGroup } from "~/group-page.server";
import { meetupCalendar } from "~/models/group-board.server";
import { publicOrigin } from "~/origin.server";

// A group's next meetup, for a member to add to their own calendar
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { group } = await loadGroup(request, params);
  const meetup = await prisma.group.findUnique({
    where: { id: group.id },
    select: { meetsAt: true, meetPlace: true, pickTitle: true, pickAuthor: true },
  });
  if (!meetup?.meetsAt) throw new Response("Not Found", { status: 404 });
  const ics = meetupCalendar({
    groupId: group.id,
    name: group.name,
    at: meetup.meetsAt,
    place: meetup.meetPlace,
    pick: meetup.pickTitle ? { title: meetup.pickTitle, author: meetup.pickAuthor ?? "" } : null,
    url: `${publicOrigin(request)}${groupPath(group)}`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(group.name) || "meetup"}-meetup.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
};
