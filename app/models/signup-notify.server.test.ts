// @vitest-environment node
import { renderNewSignup, renderSignupSummary } from "~/email.server";

import { makeUser, prisma } from "../../test/db";

import {
  getAdminEmailChoices,
  notifyAdminsOfSignup,
  sendDailySignupSummaries,
  setAdminEmailChoices,
} from "./admin.server";

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
  expect(sent[0].total).toBe(await prisma.user.count({ where: { demoGroup: null, invitedAt: null } }));
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

test("admins who chose a daily summary or off aren't emailed for each sign-up", async () => {
  const daily = await makeUser("DailyAdmin");
  const off = await makeUser("QuietAdmin");
  await prisma.user.update({ where: { id: daily.id }, data: { isAdmin: true, adminSignupEmails: "daily" } });
  await prisma.user.update({ where: { id: off.id }, data: { isAdmin: true, adminSignupEmails: "off" } });
  const newcomer = await makeUser("Joiner");

  const recipients: string[] = [];
  await notifyAdminsOfSignup(newcomer, {
    send: async ({ toEmail }) => {
      recipients.push(toEmail);
    },
  });
  expect(recipients).not.toContain(daily.email);
  expect(recipients).not.toContain(off.email);
});

test("the daily summary lists the day's sign-ups for admins who chose it", async () => {
  const daily = await makeUser("SummaryAdmin");
  const each = await makeUser("EachAdmin");
  await prisma.user.update({ where: { id: daily.id }, data: { isAdmin: true, adminSignupEmails: "daily" } });
  await prisma.user.update({ where: { id: each.id }, data: { isAdmin: true, adminSignupEmails: "each" } });
  // A day in the future, so only the accounts made for this test fall in it
  const now = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const recent = await makeUser("Recent");
  await prisma.user.update({ where: { id: recent.id }, data: { createdAt: new Date(now.getTime() - 60 * 60 * 1000) } });
  const older = await makeUser("Older");
  await prisma.user.update({ where: { id: older.id }, data: { createdAt: new Date(now.getTime() - 30 * 60 * 60 * 1000) } });
  const demo = await makeUser("DemoJoiner", { demoGroup: "summary-demo" });
  await prisma.user.update({ where: { id: demo.id }, data: { createdAt: new Date(now.getTime() - 60 * 60 * 1000) } });

  const sent: { toEmail: string; signups: { name: string }[] }[] = [];
  const result = await sendDailySignupSummaries({
    now,
    send: async (message) => {
      sent.push(message);
    },
  });
  const recipients = sent.map((message) => message.toEmail);
  expect(recipients).toContain(daily.email);
  expect(recipients).not.toContain(each.email);
  expect(sent[0].signups.map((person) => person.name)).toEqual(["Recent Reader"]);
  expect(result.signups).toBe(1);
});

test("a day with no sign-ups sends no summary", async () => {
  const daily = await makeUser("IdleAdmin");
  await prisma.user.update({ where: { id: daily.id }, data: { isAdmin: true, adminSignupEmails: "daily" } });
  let calls = 0;
  const result = await sendDailySignupSummaries({
    now: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000),
    send: async () => {
      calls++;
    },
  });
  expect(calls).toBe(0);
  expect(result.sent).toBe(0);
});

test("an admin's email choices save one at a time and read back", async () => {
  const admin = await makeUser("ChoosyAdmin");
  expect(await getAdminEmailChoices(admin.id)).toEqual({ signups: "each", feedback: true });
  await setAdminEmailChoices(admin.id, { signups: "daily" });
  await setAdminEmailChoices(admin.id, { feedback: false });
  expect(await getAdminEmailChoices(admin.id)).toEqual({ signups: "daily", feedback: false });
});

test("the summary email lists each person and the total", () => {
  const { subject, html } = renderSignupSummary({
    signups: [
      { name: "Ada <Lovelace>", email: "ada@example.test" },
      { name: "Grace Hopper", email: "grace@example.test" },
    ],
    total: 42,
  });
  expect(subject).toBe("2 new sign-ups in the last day");
  expect(html).toContain("Ada &lt;Lovelace&gt;");
  expect(html).toContain("grace@example.test");
  expect(html).toContain("42 accounts");
});
