import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/shared/page-intro";

export const metadata = { title: "Live class" };

export default async function MobileLivePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
      <PageIntro kicker="Mobile" title="Live class" description="Join from the link your instructor shared." />
      <Card>
        <CardHeader>
          <CardTitle>{url ? "Ready to join" : "No class link"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {url
              ? "The class opens in a new step. Use the same account you enrolled with."
              : "This page was opened without a class link. Ask the instructor for the join URL."}
          </p>
        </CardContent>
        {url ? (
          <CardFooter>
            <Button className="h-11" nativeButton={false} render={<a href={url} />}>
              Join class
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </main>
  );
}
