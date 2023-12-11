import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const email = "rachel31@remix.run";
  const secondEmail = "graham31@remix.run";

  // cleanup the existing database
  await prisma.user.delete({ where: { email } }).catch(() => {
    // no worries if it doesn't exist yet
  });

  const hashedPassword = await bcrypt.hash("racheliscool", 10);
  const secondHashedPassword = await bcrypt.hash("grahamiscool", 10);

  const user = await prisma.user.create({
    data: {
      email: email,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });

  const secondUser = await prisma.user.create({
    data: {
      email: secondEmail,
      password: {
        create: {
          hash: secondHashedPassword,
        },
      },
    },
  });
  

  await prisma.book.create({
    data: {
      title: "My first note",
      body: "Hello, world!",
      cover: "https://m.media-amazon.com/images/W/MEDIAX_792452-T1/images/I/41-yZIthD3L._SY445_SX342_.jpg",
      userId: user.id,
    },
  });

  await prisma.book.create({
    data: {
      title: "My second note",
      body: "Hello, world!",
      cover: "https://m.media-amazon.com/images/W/MEDIAX_792452-T1/images/I/41-yZIthD3L._SY445_SX342_.jpg",
      userId: user.id,
    },
  });

  await prisma.book.create({
    data: {
      title: "My second note",
      body: "Hello, world!",
      cover: "https://m.media-amazon.com/images/W/MEDIAX_792452-T1/images/I/41-yZIthD3L._SY445_SX342_.jpg",
      userId: secondUser.id,
    },
  });

  console.log(`Database has been seeded. 🌱`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
