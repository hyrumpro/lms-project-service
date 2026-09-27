import { NextResponse } from "next/server";
import { verifyRazorpaySignature } from "@/lib/payments";
import { fulfillOrder } from "@/server/services/checkout";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await request.json().catch(() => null)) as Record<string, string> | null)
    : Object.fromEntries(await request.formData()) as Record<string, string>;
  const razorpayOrderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;
  const orderId = body?.orderId;
  if (!razorpayOrderId || !paymentId || !signature || !orderId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!verifyRazorpaySignature(razorpayOrderId, paymentId, signature)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await fulfillOrder(orderId, { transactionId: paymentId, gateway: "razorpay" });
  return NextResponse.redirect(new URL(`/dashboard/invoices/${orderId}`, request.url));
}
