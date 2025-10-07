import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const u = new URL(req.url)
  const event = u.searchParams.get("event") // "install" | "purchase"
  const clickId = u.searchParams.get("click_id")
  const amount = Number(u.searchParams.get("amount") || 0)
  const externalId = u.searchParams.get("external_id") || undefined
  const secret = u.searchParams.get("secret") || undefined

  if (!event || !clickId) return NextResponse.json({ ok:false, error:"missing" }, { status:400 })

  const click = await prisma.click.findFirst({
    where: { clickId },
    include: { link: { include: { task: { include: { offer: true } }, creator: true } } }
  })
  if (!click) return NextResponse.json({ ok:false, error:"not_found" }, { status:404 })

  if (secret && click.link.task.offer.postbackSecret && secret !== click.link.task.offer.postbackSecret) {
    return NextResponse.json({ ok:false, error:"forbidden" }, { status:403 })
  }

  const type = event === "purchase" ? "PURCHASE" : "INSTALL"

  const conv = await prisma.conversion.upsert({
    where: { externalId: externalId ?? `cid:${clickId}:evt:${event}` },
    update: {},
    create: { linkId: click.linkId, type, amount: type === "PURCHASE" ? amount : null, externalId, raw: { event, clickId, amount } }
  })

  const day = new Date(); day.setUTCHours(0,0,0,0)
  await prisma.stat.upsert({
    where: { userId_date: { userId: click.link.creatorId, date: day } },
    update: {
      installs: { increment: type === "INSTALL" ? 1 : 0 },
      purchases: { increment: type === "PURCHASE" ? 1 : 0 },
      revenue: { increment: type === "PURCHASE" ? amount : 0 }
    },
    create: {
      userId: click.link.creatorId, date: day,
      clicks: 0, installs: type === "INSTALL" ? 1 : 0,
      purchases: type === "PURCHASE" ? 1 : 0,
      revenue: type === "PURCHASE" ? amount : 0
    }
  })

  if (type === "PURCHASE" && amount > 0) {
    await prisma.wallet.upsert({
      where: { userId: click.link.creatorId },
      update: { balance: { increment: amount } },
      create: { userId: click.link.creatorId, balance: amount, locked: 0 }
    })
  }

  return NextResponse.json({ ok:true, id: conv.id })
}
