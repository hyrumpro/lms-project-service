import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RazorpayCheckout } from "@/components/checkout/razorpay-checkout";
import { PageIntro } from "@/components/shared/page-intro";

export const metadata = { title: "Razorpay" };

export default async function RazorpayPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; razorpayOrderId?: string; key?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <PageIntro
        kicker="Checkout"
        title="Razorpay"
        description="Enter the payment id and signature to finish this order."
      />
      {!params.orderId || !params.razorpayOrderId || !params.key ? (
        <Alert variant="destructive">
          <AlertTitle>Checkout link is incomplete</AlertTitle>
          <AlertDescription>Go back to the cart and start Razorpay again.</AlertDescription>
        </Alert>
      ) : (
        <RazorpayCheckout orderId={params.orderId} razorpayOrderId={params.razorpayOrderId} keyId={params.key} />
      )}
    </main>
  );
}
