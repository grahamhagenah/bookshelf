// @vitest-environment node
import { renderNewSignup } from "~/email.server";

import { makeUser, prisma } from "../../test/db";

import { notifyAdminsOfSignup } from "./admin.server";

test("every real admin hears about a new sign-up, with the new total", async () => {
  const admin = await makeUser("Admin");
  await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
  const demoAdmin = await makeUser("DemoAdmin", { demoGroup: "signup-notify-demo" });
  await prisma.user.update({ where: { id: demoAdmin.id }, data: { isAdmin: true } });
  const newcomer = await makeUser("Newcomer");

  const sent: { toEmail: string; name: string; invitedBy: string | null; total: number }[] = [];
  await notifyAdminsOfSignup(newcomer, {
    invitedBy: "Maya Chen",
    send: async (message) => {
      sent.push(message);
      return { success: true };
    },
  });

  const recipients = sent.map((message) => message.toEmail);
  expect(recipients).toContain(admin.email);
  expect(recipients).not.toContain(demoAdmin.email);
  expect(sent[0]).toMatchObject({ name: "Newcomer Reader", invitedBy: "Maya Chen" });
  expect(sent[0].total).toBe(await prisma.user.count({ where: { demoGroup: null } }));
});

test("one failed email doesn't stop the rest", async () => {
  const first = await makeUser("AdminOne");
  const second = await makeUser("AdminTwo");
  await prisma.user.updateMany({ where: { id: { in: [first.id, second.id] } }, data: { isAdmin: true } });
  const newcomer = await makeUser("Another");

  const tried: string[] = [];
  await notifyAdminsOfSignup(newcomer, {
    send: async ({ toEmail }) => {
      tried.push(toEmail);
      if (toEmail === first.email) throw new Error("mail server down");
      return { success: true };
    },
  });
  expect(tried).toEqual(expect.arrayContaining([first.email, second.email]));
});

test("the sign-up email names the person, escapes it, and gives the total", () => {
  const { subject, html, text } = renderNewSignup({
    name: "Tom & Jerry",
    email: "tom@example.test",
    invitedBy: null,
    total: 1204,
  });
  expect(subject).toBe("New sign-up: Tom & Jerry");
  expect(html).toContain("Tom &amp; Jerry");
  expect(html).toContain("1,204 accounts");
  expect(html).not.toContain("shared shelf");
  expect(text).toContain("tom@example.test");
});
