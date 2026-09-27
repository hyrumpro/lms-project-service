import { NextResponse } from "next/server";
import { REGIONAL_GATEWAYS, verifyRegionalCallback } from "@/lib/payments";
import { fulfillOrder } from "@/server/services/checkout";

type Params = Promise<{ gateway: string }>;

async function handle(request: Request, gateway: string) {
  if (!(REGIONAL_GATEWAYS as readonly string[]).includes(gateway)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const url = new URL(request.url);
  let orderId = url.searchParams.get("order_id") ?? "";
  let amount = url.searchParams.get("amount") ?? "";
  let signature = url.searchParams.get("sig") ?? "";
  if (request.method === "POST") {
    const form = await request.formData().catch(() => null);
    orderId = String(form?.get("order_id") ?? orderId);
    amount = String(form?.get("amount") ?? amount);
    signature = String(form?.get("sig") ?? signature);
  }
  if (!verifyRegionalCallback(gateway, orderId, amount, signature)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await fulfillOrder(orderId, { transactionId: `${gateway}-${signature.slice(0, 12)}`, gateway });
  return NextResponse.redirect(new URL(`/dashboard/invoices/${orderId}`, request.url));
}

export async function GET(request: Request, { params }: { params: Params }) {
  const { gateway } = await params;
  return handle(request, gateway);
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { gateway } = await params;
  return handle(request, gateway);
}
