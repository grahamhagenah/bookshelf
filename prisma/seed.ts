import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const email = "graham@gmail.com";

  // cleanup the existing database
  await prisma.user.delete({ where: { email } }).catch(() => {
    // no worries if it doesn't exist yet
  });

  const hashedPassword = await bcrypt.hash("grahamiscool", 10);

  const user = await prisma.user.create({
    data: {
      email: email,
      firstname: "Graham",
      surname: "Hagenah",
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });

  await prisma.book.create({
    data: {
      title: "My first book",
      author: "Hello",
      body: "Hello, world!",
      cover: "https://m.media-amazon.com/images/W/MEDIAX_792452-T1/images/I/41-yZIthD3L._SY445_SX342_.jpg",
      userId: user.id,
    },
  });

  await prisma.book.create({
    data: {
      title: "My second book",
      author: "Hello",
      body: "Hello, world!",
      cover: "https://m.media-amazon.com/images/W/MEDIAX_792452-T1/images/I/41-yZIthD3L._SY445_SX342_.jpg",
      userId: user.id,
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
