import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const email = "rachel2@remix.run";
  const secondEmail = "graham2@remix.run";

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

  // // Establish friendships
  // await prisma.user.update({
  //   where: { id: user.id },
  //   data: {
  //     followedBy: {
  //       create: [{ id: secondUser.id }]
  //       },
  //     following: {
  //       create: [{ id: user.id }]
  //       },
  //     },
  //   })

  //   await prisma.user.update({
  //     where: { id: secondUser.id },
  //     data: {
  //       followedBy: {
  //         create: [{ id: user.id }]
  //         },
  //       following: {
  //         create: [{ id: user.id }]
  //         },
  //       },
  //     })
  

  await prisma.book.create({
    data: {
      title: "My first note",
      body: "Hello, world!",
      userId: user.id,
    },
  });

  await prisma.book.create({
    data: {
      title: "My second note",
      body: "Hello, world!",
      userId: user.id,
    },
  });

  await prisma.book.create({
    data: {
      title: "My second note",
      body: "Hello, world!",
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
