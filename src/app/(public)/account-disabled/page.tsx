import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = { title: "Account disabled" };

export default function AccountDisabledPage() {
  return (
    <AuthShell
      title="This account is paused."
      accentWord="paused"
      quote="Your account has been disabled. Please contact the administrator."
      attribution="Academy"
    >
      <header className="flex flex-col gap-1">
        <p className="kicker">Account · Disabled</p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight">You cannot sign in right now.</h2>
      </header>
      <p className="text-muted-foreground text-sm">
        An administrator disabled this account. Contact the school if you think this is a mistake.
      </p>
      <p className="text-sm">
        <Link href="/contact" className="text-coral font-medium hover:underline">
          Contact the school
        </Link>
      </p>
    </AuthShell>
  );
}
