import type { SystemSettings } from "@/lib/settings";

/**
 * Money is stored in minor units (integer cents) — see spec §3.6.
 * Rendering mirrors the legacy `currency()` helper: symbol on the
 * configured side, decimals trimmed when whole.
 */

export type CurrencyMeta = Pick<SystemSettings, "currencySymbol" | "currencyPosition">;

export function formatMoney(minor: number, currency: CurrencyMeta): string {
  const major = minor / 100;
  const value = Number.isInteger(major) ? String(major) : major.toFixed(2);
  return currency.currencyPosition === "left"
    ? `${currency.currencySymbol}${value}`
    : `${value}${currency.currencySymbol}`;
}

export type CoursePricing = {
  isFree: boolean;
  price: number;
  discountEnabled: boolean;
  discountedPrice: number;
};

export function effectivePrice(course: CoursePricing): number {
  if (course.isFree) return 0;
  if (course.discountEnabled && course.discountedPrice > 0) return course.discountedPrice;
  return course.price;
}

export function coursePriceLabel(
  course: CoursePricing,
  currency: CurrencyMeta,
): { label: string; original?: string } {
  if (effectivePrice(course) === 0) return { label: "Free" };
  const hasDiscount =
    course.discountEnabled && course.discountedPrice > 0 && course.discountedPrice < course.price;
  return {
    label: formatMoney(effectivePrice(course), currency),
    original: hasDiscount ? formatMoney(course.price, currency) : undefined,
  };
}
