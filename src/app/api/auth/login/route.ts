import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { setSessionCookie } from "@/lib/auth";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (typeof password !== "string" || !safeEqual(password, process.env.AUTH_PASSWORD ?? "")) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
