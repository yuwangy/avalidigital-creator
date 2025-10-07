import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs" // Prisma Client needs Node runtime

export async function GET(req: NextRequest, { params }: { params: { slug: string }}) {
  const link = await prisma.link.findUnique({
    where: { slug: params.slug },
    include: { task: { include: { offer: true } } }
  })
  if (!link || !link.task.active || !link.task.offer.active) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  const ua = req.headers.get("user-agent") || ""
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const offer = link.task.offer

  const dest =
    isIOS ? offer.iosUrl ?? offer.webUrl :
    isAndroid ? offer.androidUrl ?? offer.webUrl :
    offer.webUrl

  if (!dest) return NextResponse.redirect(new URL("/", req.url))

  const clickId = crypto.randomUUID()
  await prisma.click.create({ data: { linkId: link.id, clickId, ip, ua } })

  const url = new URL(dest)
  url.searchParams.set("utm_source", link.utmSource ?? "creator")
  url.searchParams.set("utm_medium", link.utmMedium ?? "social")
  url.searchParams.set("utm_campaign", link.utmCampaign ?? link.slug)
  url.searchParams.set("click_id", clickId)

  const res = NextResponse.redirect(url.toString(), 302)
  res.cookies.set("cid", clickId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60*60*24*30 })
  return res
}
