import { NextResponse } from "next/server";
import { verifyStripeEvent } from "@/lib/payments";
import { fulfillOrder } from "@/server/services/checkout";

export async function POST(request: Request) {
  const raw = await request.text();
  try {
    const verified = verifyStripeEvent(raw, request.headers.get("stripe-signature"));
    if (!verified) return NextResponse.json({ ok: false }, { status: 400 });
    await fulfillOrder(verified.orderId, { transactionId: verified.transactionId, gateway: "stripe" });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
