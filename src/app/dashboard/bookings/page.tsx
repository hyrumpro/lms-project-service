import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { bookings, tutorSlots, tutors } from "@/db/schema";
import { auth } from "@/lib/auth";
import { CatalogEmpty } from "@/components/shared/catalog-empty";
import { PageIntro } from "@/components/shared/page-intro";

export const metadata = { title: "My bookings" };

export default async function BookingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const rows = await db
    .select({
      id: bookings.id,
      startsAt: tutorSlots.startsAt,
      subject: tutors.subject,
    })
    .from(bookings)
    .innerJoin(tutorSlots, eq(tutorSlots.id, bookings.slotId))
    .innerJoin(tutors, eq(tutors.id, tutorSlots.tutorId))
    .where(eq(bookings.studentId, session.user.id))
    .orderBy(desc(bookings.createdAt));
  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        kicker="Account"
        title="My bookings"
        description="Upcoming tutor sessions you have reserved."
      />
      {rows.length === 0 ? (
        <CatalogEmpty
          icon={<CalendarClock />}
          title="No bookings yet"
          description="Choose a tutor and an open time. The session will show up here."
          href="/tutors"
          action="Find a tutor"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{row.subject}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm tabular-nums">{row.startsAt.toLocaleString()}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
