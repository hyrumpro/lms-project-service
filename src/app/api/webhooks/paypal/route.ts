import { NextResponse } from "next/server";
import { capturePaypalOrder } from "@/lib/payments";
import { fulfillOrder } from "@/server/services/checkout";

/** PayPal return URL captures the approved order, then fulfills once. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paypalOrderId = url.searchParams.get("token");
  if (!paypalOrderId) return NextResponse.json({ ok: false }, { status: 400 });
  const captured = await capturePaypalOrder(paypalOrderId);
  if (!captured) return NextResponse.redirect(new URL("/dashboard/shopping-cart", request.url));
  await fulfillOrder(captured.orderId, { transactionId: captured.transactionId, gateway: "paypal" });
  return NextResponse.redirect(new URL(`/dashboard/invoices/${captured.orderId}`, request.url));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    resource?: { id?: string; purchase_units?: { custom_id?: string }[] };
  } | null;
  const orderId = body?.resource?.purchase_units?.[0]?.custom_id;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!orderId || !webhookId) return NextResponse.json({ ok: false }, { status: 400 });
  const transmissionId = request.headers.get("paypal-transmission-id");
  if (!transmissionId) return NextResponse.json({ ok: false }, { status: 400 });
  await fulfillOrder(orderId, { transactionId: body?.resource?.id, gateway: "paypal" });
  return NextResponse.json({ ok: true });
}
