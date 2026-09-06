import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ApplicationButtons, UserToggles } from "@/components/admin/controls";
import { AdminFlagsEditor } from "@/components/admin/flags-editor";
import { listAdminFlags, listApplications, listUsers } from "@/server/queries/admin";

export const metadata = { title: "Admin · Users" };

export default async function AdminUsersPage() {
  const [users, applications, flagsList] = await Promise.all([
    listUsers(),
    listApplications(),
    listAdminFlags(),
  ]);
  const adminFlags = Object.fromEntries(flagsList.map((f) => [f.userId, f.flags]));
  const pendingApps = applications.filter((a) => a.status === "pending");

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="kicker">03 · People</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Users</h1>
      </header>

      {pendingApps.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">
            Instructor applications{" "}
            <span className="text-coral">({pendingApps.length} pending)</span>
          </h2>
          <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
            {pendingApps.map((app) => (
              <li key={app.id} className="flex flex-wrap items-center gap-3 bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{app.userName}</p>
                  <p className="text-muted-foreground line-clamp-1 text-sm">{app.message}</p>
                </div>
                <ApplicationButtons applicationId={app.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 bg-card p-4">
            <Avatar className="size-9">
              <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.name}</span>
                {u.role === "admin" && <Badge>admin</Badge>}
                {u.isInstructor && <Badge variant="secondary">instructor</Badge>}
                {u.status === "disabled" && <Badge variant="destructive">disabled</Badge>}
              </div>
              <p className="text-muted-foreground text-sm">{u.email}</p>
            </div>
            {u.role !== "admin" && (
              <UserToggles
                userId={u.id}
                isInstructor={Boolean(u.isInstructor)}
                disabled={u.status === "disabled"}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
