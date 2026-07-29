import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const others = await db.project.upsert({
    where: { name: "Others" },
    update: {},
    create: { name: "Others", color: "#94a3b8", isSystem: true },
  });

  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  console.log(`Seeded. System project "${others.name}" = ${others.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
