import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseCard } from "@/components/course/course-card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Heart } from "lucide-react";
import { getSystemSettings } from "@/lib/settings";
import { getWishlist, requireSession } from "@/server/queries/community";

export const metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const [items, system] = await Promise.all([getWishlist(session.user.id), getSystemSettings()]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">03 · Saved for later</p>
        <h1 className="text-3xl font-semibold tracking-tight">Wishlist</h1>
      </header>

      {items.length === 0 ? (
        <Empty className="border-2 border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Heart />
            </EmptyMedia>
            <EmptyTitle>Nothing saved yet</EmptyTitle>
            <EmptyDescription>
              Tap the heart on any course page to keep it here for later.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((course) => (
            <CourseCard key={course.id} course={course} currency={system} />
          ))}
        </div>
      )}
    </div>
  );
}
