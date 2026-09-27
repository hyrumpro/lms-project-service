import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "SuperSecret123!";
const BOOTCAMP = "508c5f45-2b3c-4980-bee8-fd8b4d99f179";

async function dismissCookies(page: Page) {
  const essential = page.getByRole("button", { name: "Essential only" });
  if (await essential.isVisible().catch(() => false)) {
    await essential.click();
  }
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await dismissCookies(page);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("main").getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 30_000 });
}

test("public catalog and auth entry points render", async ({ page }) => {
  await page.goto("/courses");
  await expect(page.locator("body")).toBeVisible();
  await page.goto("/sign-in");
  await expect(page.getByRole("main").getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.goto("/forgot-password");
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Choose a new password." })).toBeVisible();
});

test("editorial catalog and mobile shells render", async ({ page }) => {
  await page.goto("/bundles");
  await expect(page.getByRole("heading", { name: "Course bundles" })).toBeVisible();
  await page.goto("/ebooks");
  await expect(page.getByRole("heading", { name: "Ebooks" })).toBeVisible();
  await page.goto("/tutors");
  await expect(page.getByRole("heading", { name: "Tutors" })).toBeVisible();
  await page.goto("/checkout/razorpay");
  await expect(page.getByText("Checkout link is incomplete")).toBeVisible();
  await page.goto("/m/quiz");
  await expect(page.getByRole("heading", { name: "Quiz" })).toBeVisible();
  await page.goto("/m/live");
  await expect(page.getByRole("heading", { name: "Live class" })).toBeVisible();
  await page.goto("/m/pay");
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
});

test("student can open dashboard, cart, and the lesson player", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, "john@academy-next.test");
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Bookings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Affiliate" })).toBeVisible();
  await page.goto("/dashboard/affiliate");
  await expect(page.getByRole("heading", { name: "Affiliate" })).toBeVisible();
  await page.goto("/dashboard/shopping-cart");
  await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await page.goto(`/learn/${BOOTCAMP}`);
  await page.waitForURL(/\/learn\/.+\/.+/, { timeout: 40_000 });
  await expect(page.getByText("Live class", { exact: true })).toBeVisible();
  await expect(page.getByText("Noticeboard", { exact: true })).toBeVisible();
  await expect(page.getByText("Q&A", { exact: true })).toBeVisible();
});

test("admin settings are grouped and save", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, "admin@academy-next.test");
  await page.goto("/admin/settings");
  const form = page.locator("form");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(form.getByText("Site", { exact: true })).toBeVisible();
  await expect(form.getByText("Commerce", { exact: true })).toBeVisible();
  await expect(form.getByText("Sign-in", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Site name")).toBeVisible();
  const saved = page.waitForResponse(
    (response) => response.url().includes("/admin/settings") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save settings" }).click();
  expect((await saved).status()).toBeLessThan(400);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});
