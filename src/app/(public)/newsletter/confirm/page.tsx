import { confirmNewsletter } from "@/server/actions/blog";

export const metadata = { title: "Confirm newsletter" };

export default async function ConfirmNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const result = email ? await confirmNewsletter(email) : { ok: false as const };
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold">Newsletter</h1>
      <p className="text-muted-foreground mt-3 text-sm">
        {result.ok ? "Your subscription is confirmed." : "This confirmation link is missing an email."}
      </p>
    </main>
  );
}
