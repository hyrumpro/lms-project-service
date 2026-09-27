import { createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";

export const REGIONAL_GATEWAYS = [
  "payu",
  "sslcommerz",
  "xendit",
  "doku",
  "cashfree",
  "maxicash",
  "aamarpay",
  "tazapay",
  "skrill",
  "pagseguro",
  "paystack",
] as const;

export type RegionalGateway = (typeof REGIONAL_GATEWAYS)[number];

const APP = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";

function hmac(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function createStripeCheckout(orderId: string, amountCents: number) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const stripe = new Stripe(key);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${APP}/dashboard/invoices/${orderId}`,
    cancel_url: `${APP}/dashboard/shopping-cart`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: (process.env.CHECKOUT_CURRENCY ?? "usd").toLowerCase(),
          unit_amount: amountCents,
          product_data: { name: `Academy order ${orderId.slice(0, 8)}` },
        },
      },
    ],
    metadata: { orderId },
  });
  if (!session.url) return null;
  return { redirectUrl: session.url, sessionId: session.id };
}

export function verifyStripeEvent(rawBody: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key || !signature) return null;
  const stripe = new Stripe(key);
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  if (event.type !== "checkout.session.completed") return null;
  const session = event.data.object;
  const orderId = session.metadata?.orderId;
  if (!orderId) return null;
  return { orderId, transactionId: session.id };
}

async function paypalAccessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return null;
  const base = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { access_token?: string };
  return json.access_token ? { token: json.access_token, base } : null;
}

export async function createPaypalCheckout(orderId: string, amountCents: number) {
  const auth = await paypalAccessToken();
  if (!auth) return null;
  const response = await fetch(`${auth.base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: orderId,
          amount: { currency_code: process.env.CHECKOUT_CURRENCY ?? "USD", value: (amountCents / 100).toFixed(2) },
        },
      ],
      application_context: {
        return_url: `${APP}/api/webhooks/paypal?orderId=${orderId}`,
        cancel_url: `${APP}/dashboard/shopping-cart`,
      },
    }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { id?: string; links?: { rel: string; href: string }[] };
  const approve = json.links?.find((link) => link.rel === "approve");
  if (!approve) return null;
  return { redirectUrl: approve.href, sessionId: json.id ?? "" };
}

export async function capturePaypalOrder(paypalOrderId: string) {
  const auth = await paypalAccessToken();
  if (!auth) return null;
  const response = await fetch(`${auth.base}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    id?: string;
    purchase_units?: { custom_id?: string }[];
  };
  const orderId = json.purchase_units?.[0]?.custom_id;
  if (!orderId) return null;
  return { orderId, transactionId: json.id ?? paypalOrderId };
}

export async function createRazorpayCheckout(orderId: string, amountCents: number) {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) return null;
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountCents, currency: process.env.CHECKOUT_CURRENCY ?? "USD", receipt: orderId }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { id?: string };
  if (!json.id) return null;
  const params = new URLSearchParams({ orderId, razorpayOrderId: json.id, key });
  return { redirectUrl: `${APP}/checkout/razorpay?${params}`, sessionId: json.id };
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = hmac(secret, `${orderId}|${paymentId}`);
  return safeEqual(expected, signature);
}

export function createRegionalCheckout(gateway: string, orderId: string, amountCents: number) {
  const secret = process.env[`${gateway.toUpperCase()}_SECRET`];
  const checkoutUrl = process.env[`${gateway.toUpperCase()}_CHECKOUT_URL`];
  if (!secret || !checkoutUrl) return null;
  const payload = `${orderId}.${amountCents}`;
  const sig = hmac(secret, payload);
  const url = new URL(checkoutUrl);
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("amount", String(amountCents));
  url.searchParams.set("sig", sig);
  url.searchParams.set("return_url", `${APP}/api/webhooks/regional/${gateway}`);
  return { redirectUrl: url.toString(), sessionId: sig };
}

export function verifyRegionalCallback(gateway: string, orderId: string, amountCents: string, signature: string) {
  const secret = process.env[`${gateway.toUpperCase()}_SECRET`];
  if (!secret || !orderId || !signature) return false;
  return safeEqual(hmac(secret, `${orderId}.${amountCents}`), signature);
}

export async function startExternalCheckout(gateway: string, orderId: string, amountCents: number) {
  if (gateway === "stripe") return createStripeCheckout(orderId, amountCents);
  if (gateway === "paypal") return createPaypalCheckout(orderId, amountCents);
  if (gateway === "razorpay") return createRazorpayCheckout(orderId, amountCents);
  if ((REGIONAL_GATEWAYS as readonly string[]).includes(gateway)) {
    return createRegionalCheckout(gateway, orderId, amountCents);
  }
  return null;
}
