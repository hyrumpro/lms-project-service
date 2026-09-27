import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyRazorpaySignature, verifyRegionalCallback } from "@/lib/payments";
import { answersMatch, enrollmentState } from "@/lib/quiz-grade";
import { priceCart, splitRevenue } from "@/lib/pricing";

describe("quiz grading", () => {
  it("matches choice answers after sorting", () => {
    expect(answersMatch("multiple_choice", ["b", "a"], ["a", "b"])).toBe(true);
    expect(answersMatch("single_choice", ["yes"], ["no"])).toBe(false);
  });

  it("matches fill-in-the-blank without case", () => {
    expect(answersMatch("fill_in_the_blank", ["  Paris "], ["paris"])).toBe(true);
  });
});

describe("pricing", () => {
  const course = {
    id: "c1",
    title: "Demo",
    isFree: false,
    price: 2000,
    discountEnabled: true,
    discountedPrice: 1999,
  };

  it("applies the coupon after the course discount", () => {
    const cart = priceCart([course], { discountPercentage: 10 }, 0);
    expect(cart.lines[0].net).toBe(1800);
    expect(cart.total).toBe(1800);
  });

  it("treats a 100 percent coupon as free", () => {
    const cart = priceCart([course], { discountPercentage: 100 }, 0);
    expect(cart.total).toBe(0);
  });

  it("splits revenue from the instructor percent", () => {
    expect(splitRevenue(1000, 70)).toEqual({ instructorRevenue: 700, adminRevenue: 300 });
  });
});

describe("enrollment access", () => {
  it("returns none, expired, or valid", () => {
    expect(enrollmentState(null)).toBe("none");
    expect(enrollmentState({ expiresAt: new Date("2000-01-01") })).toBe("expired");
    expect(enrollmentState({ expiresAt: null })).toBe("valid");
  });
});

describe("webhook signatures", () => {
  it("accepts a regional HMAC callback", () => {
    process.env.PAYSTACK_SECRET = "secret";
    const signature = createHmac("sha256", "secret").update("order.100").digest("hex");
    expect(verifyRegionalCallback("paystack", "order", "100", signature)).toBe(true);
    expect(verifyRegionalCallback("paystack", "order", "100", "nope")).toBe(false);
  });

  it("rejects a razorpay signature when the secret is missing", () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(verifyRazorpaySignature("order", "pay", "sig")).toBe(false);
  });
});
