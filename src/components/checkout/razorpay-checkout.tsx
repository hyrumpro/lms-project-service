"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function RazorpayCheckout({
  orderId,
  razorpayOrderId,
  keyId,
}: {
  orderId: string;
  razorpayOrderId: string;
  keyId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm the payment</CardTitle>
      </CardHeader>
      <form action="/api/webhooks/razorpay" method="post">
        <CardContent className="flex flex-col gap-4">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="razorpay_order_id" value={razorpayOrderId} />
          <Field>
            <FieldLabel htmlFor="razorpay_payment_id">Payment id</FieldLabel>
            <Input id="razorpay_payment_id" name="razorpay_payment_id" required className="h-11" autoComplete="off" />
          </Field>
          <Field>
            <FieldLabel htmlFor="razorpay_signature">Signature</FieldLabel>
            <Input id="razorpay_signature" name="razorpay_signature" required className="h-11" autoComplete="off" />
            <FieldDescription>Paste the signature returned by Razorpay for this order.</FieldDescription>
          </Field>
          <Alert>
            <AlertDescription>Key {keyId}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button className="h-11" type="submit">
            Verify payment
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
