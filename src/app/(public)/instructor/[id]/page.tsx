import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CourseCard } from "@/components/course/course-card";
import { FollowButton } from "@/components/shared/follow-button";
import { MessageButton } from "@/components/community/message-button";
import { auth } from "@/lib/auth";
import { getSystemSettings } from "@/lib/settings";
import { getInstructorProfile } from "@/server/queries/catalog";
import { getFollowerCount, isFollowing } from "@/server/queries/social";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await getInstructorProfile(id);
  return { title: profile ? profile.instructor.name : "Instructor not found" };
}

export default async function InstructorPage({ params }: { params: Params }) {
  const { id } = await params;
  const [profile, system, session] = await Promise.all([
    getInstructorProfile(id),
    getSystemSettings(),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!profile) notFound();

  const { instructor, courses, stats } = profile;
  const [following, followers] = await Promise.all([
    session ? isFollowing(session.user.id, instructor.id) : Promise.resolve(false),
    getFollowerCount(instructor.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <header className="mb-10 flex items-start gap-5">
        <Avatar className="size-20">
          <AvatarImage src={instructor.image ?? undefined} alt={instructor.name} />
          <AvatarFallback className="text-xl">
            {instructor.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{instructor.name}</h1>
          {instructor.title && <p className="text-muted-foreground">{instructor.title}</p>}
          <p className="text-muted-foreground text-sm">
            {courses.length} courses · {stats?.students ?? 0} students · {followers} followers
          </p>
          {instructor.biography && (
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{instructor.biography}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {session && session.user.id !== instructor.id && (
            <FollowButton
              instructorId={instructor.id}
              following={following}
              label="Follow"
              followingLabel="Following"
            />
          )}
          {(!session || session.user.id !== instructor.id) && (
            <MessageButton
              recipientId={instructor.id}
              recipientName={instructor.name}
              currentUserId={session?.user.id}
              buttonText="Message"
            />
          )}
        </div>
      </header>

      <h2 className="mb-6 text-2xl font-bold tracking-tight">Courses</h2>
      {courses.length === 0 ? (
        <p className="text-muted-foreground text-sm">No published courses yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} currency={system} />
          ))}
        </div>
      )}
    </div>
  );
}
