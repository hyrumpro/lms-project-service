"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { requestWithdrawal } from "@/server/actions/studio";

export function WithdrawForm({
  available,
  disabled,
}: {
  available: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState("paypal");

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const amount = Number(new FormData(event.currentTarget).get("amount"));
        startTransition(async () => {
          const result = await requestWithdrawal(amount, method);
          if (result.ok) {
            toast.success("Withdrawal requested — an admin will review it.");
            router.refresh();
          } else if (result.error === "insufficient" && "min" in result) {
            toast.error(`Only $${((result.min ?? 0) / 100).toFixed(2)} available.`);
          } else {
            toast.error("Enter a valid amount.");
          }
        });
      }}
    >
      <p className="kicker">Request withdrawal</p>
      <Field>
        <FieldLabel htmlFor="amount">Amount ($) — ${available.toFixed(2)} available</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            max={available}
            required
            disabled={disabled}
            placeholder={disabled ? "Nothing available" : "0.00"}
          />
          <Select name="method" value={method} onValueChange={(v) => setMethod(v ?? "paypal")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paypal">PayPal</SelectItem>
              <SelectItem value="bank">Bank transfer</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={disabled || pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Request
          </Button>
        </div>
      </Field>
    </form>
  );
}
