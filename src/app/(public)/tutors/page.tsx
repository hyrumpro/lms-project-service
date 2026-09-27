import { eq } from "drizzle-orm";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { tutorSlots, tutors, user } from "@/db/schema";
import { CatalogEmpty } from "@/components/shared/catalog-empty";
import { PageIntro } from "@/components/shared/page-intro";
import { bookTutorSlotForm } from "@/server/actions/addons";

export const metadata = { title: "Tutors" };

export default async function TutorsPage() {
  const rows = await db
    .select({
      id: tutors.id,
      subject: tutors.subject,
      hourlyRate: tutors.hourlyRate,
      bio: tutors.bio,
      name: user.name,
    })
    .from(tutors)
    .innerJoin(user, eq(user.id, tutors.userId));
  const slots = await db.select().from(tutorSlots);
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12">
      <PageIntro
        kicker="Catalog"
        title="Tutors"
        description="Book an open slot. You can review your bookings from the dashboard."
      />
      {rows.length === 0 ? (
        <CatalogEmpty
          icon={<GraduationCap />}
          title="No tutors listed"
          description="Tutor profiles appear here once an instructor opens booking."
          href="/courses"
          action="Browse courses"
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((tutor) => {
            const openSlots = slots.filter((slot) => slot.tutorId === tutor.id);
            return (
              <li key={tutor.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>{tutor.name}</CardTitle>
                    <CardDescription>{tutor.subject}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {tutor.bio ? <p className="text-muted-foreground text-sm leading-relaxed">{tutor.bio}</p> : null}
                    <p className="font-heading text-xl font-semibold tabular-nums">
                      ${(tutor.hourlyRate / 100).toFixed(2)}
                      <span className="text-muted-foreground text-sm font-normal"> / hour</span>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col items-stretch gap-2">
                    {openSlots.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No open slots.</p>
                    ) : (
                      openSlots.map((slot) => (
                        <form key={slot.id} action={bookTutorSlotForm} className="flex flex-wrap items-center justify-between gap-3">
                          <input type="hidden" name="slotId" value={slot.id} />
                          <span className="text-sm tabular-nums">{slot.startsAt.toLocaleString()}</span>
                          <Button className="h-11" type="submit" variant="outline">
                            Book
                          </Button>
                        </form>
                      ))
                    )}
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
