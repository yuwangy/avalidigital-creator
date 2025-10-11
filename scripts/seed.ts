// scripts/seed.ts
import { PrismaClient } from "../src/generated/prisma" // if this errors, use: import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "test@avalidigital.com" },
    update: {},
    create: { email: "test@avalidigital.com" },
  })

  const offer = await prisma.offer.create({
    data: { name: "Test Offer", partner: "Test", webUrl: "https://example.com", active: true },
  })

  const task = await prisma.task.create({
    data: { offerId: offer.id, title: "Promo Task #1", description: "test", active: true },
  })

  const link = await prisma.link.create({
    data: {
      slug: "test1",
      creatorId: user.id,
      taskId: task.id,
      utmSource: "tiktok",
      utmMedium: "bio",
      utmCampaign: "pilot",
    },
  })

  console.log("Seeded ✅", { userId: user.id, offerId: offer.id, taskId: task.id, slug: link.slug })
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
