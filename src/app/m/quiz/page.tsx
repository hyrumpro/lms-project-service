import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/shared/page-intro";

export const metadata = { title: "Quiz" };

export default async function MobileQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; lessonId?: string }>;
}) {
  const { courseId, lessonId } = await searchParams;
  const href = courseId && lessonId ? `/learn/${courseId}/${lessonId}` : "/courses";
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
      <PageIntro kicker="Mobile" title="Quiz" description="Quizzes open in the full lesson player." />
      <Card>
        <CardHeader>
          <CardTitle>Continue in the player</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {courseId && lessonId
              ? "This quiz is attached to a lesson. Open it to answer and submit."
              : "This link is missing a course or lesson. Browse the catalog to find the class."}
          </p>
        </CardContent>
        <CardFooter>
          <Button className="h-11" nativeButton={false} render={<Link href={href} />}>
            {courseId && lessonId ? "Open the lesson" : "Browse courses"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
