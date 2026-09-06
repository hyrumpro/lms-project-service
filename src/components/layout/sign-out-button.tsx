"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";

export function SignOutMenuItem() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("nav");

  return (
    <DropdownMenuItem
      disabled={pending}
      onSelect={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await authClient.signOut();
          router.refresh();
          router.push("/");
        });
      }}
    >
      {pending && <Spinner data-icon="inline-start" />}
      {t("signOut")}
    </DropdownMenuItem>
  );
}
