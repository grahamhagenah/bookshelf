import type { User } from "@prisma/client";

import { prisma } from "~/db.server";
import { sendFeedbackEmail } from "~/email.server";

// What people tell us from the feedback page: saved for the admin
// dashboard, and emailed to the admins as it comes in

export const FEEDBACK_MAX_LENGTH = 2000;

export async function saveFeedback({
  userId,
  body,
  page,
  email,
}: {
  userId: User["id"] | null;
  body: string;
  page?: string | null;
  email?: string | null;
}) {
  const feedback = await prisma.feedback.create({
    data: {
      userId,
      body: body.trim().slice(0, FEEDBACK_MAX_LENGTH),
      page: page?.slice(0, 200) || null,
      email: email?.trim() || null,
    },
    include: { user: { select: { firstname: true, surname: true, email: true, demoGroup: true } } },
  });

  const admins = await prisma.user.findMany({
    where: { isAdmin: true, demoGroup: null, adminFeedbackEmails: true },
    select: { email: true },
  });
  const from = feedback.user
    ? `${feedback.user.firstname} ${feedback.user.surname}${feedback.user.demoGroup ? " (demo)" : ` <${feedback.user.email}>`}`
    : feedback.email || "A visitor";
  // A failed email shouldn't lose the feedback; it's saved either way
  await Promise.all(
    admins.map((admin) =>
      sendFeedbackEmail({ toEmail: admin.email, from, body: feedback.body, page: feedback.page }).catch(
        () => null,
      ),
    ),
  );
  return feedback;
}

// Newest first, open ones before ones already dealt with
export function getFeedback(take = 50) {
  return prisma.feedback.findMany({
    orderBy: [{ done: "asc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      body: true,
      page: true,
      email: true,
      done: true,
      createdAt: true,
      user: { select: { id: true, firstname: true, surname: true, email: true, demoGroup: true } },
    },
  });
}

export function setFeedbackDone(id: string, done: boolean) {
  return prisma.feedback.update({ where: { id }, data: { done } });
}
