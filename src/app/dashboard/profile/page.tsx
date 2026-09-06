import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { AvatarUpload } from "@/components/dashboard/avatar-upload";
import { requireSession } from "@/server/queries/community";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const { user } = session;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">07 · You</p>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">
          How you appear on course pages and to your instructors.
        </p>
      </header>

      <AvatarUpload currentImage={user.image ?? null} />

      <ProfileForm
        user={{
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          title: user.title ?? "",
          biography: user.biography ?? "",
          email: user.email,
        }}
      />
    </div>
  );
}
