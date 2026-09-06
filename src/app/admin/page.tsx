import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminStats } from "@/components/admin/stats";
import { ManualEnrollForm } from "@/components/admin/manual-enroll";
import { getAdminStats, listAllCourses, listPendingPosts } from "@/server/queries/admin";

export const metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const [stats, pendingPosts, courses] = await Promise.all([
    getAdminStats(),
    listPendingPosts(),
    listAllCourses(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="kicker">01 · Platform</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Dashboard</h1>
      </header>

      <AdminStats stats={stats} />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">CSV exports</h2>
        <div className="flex flex-wrap gap-2">
          {[
            ['enrollments', 'Enrollment history'],
            ['students', 'All users'],
            ['orders', 'Orders'],
          ].map(([kind, label]) => (
            <Button key={kind} variant="outline" size="sm" render={<a href={`/api/admin/export/${kind}`} download />}>
              <Download data-icon="inline-start" />
              {label}
            </Button>
          ))}
        </div>
      </section>

      <ManualEnrollForm courses={courses.map((c) => ({ id: c.id, title: c.title }))} />

      {pendingPosts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">Blog awaiting moderation</h2>
          <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
            {pendingPosts.map((post) => (
              <li key={post.id} className="bg-card p-4 text-sm">
                <span className="font-medium">{post.title}</span>{" "}
                <span className="text-muted-foreground">by {post.authorName}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Publish or send back from{" "}
            <Link href="/admin/content" className="underline">
              Content
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
