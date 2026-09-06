"use client";

export function AdminStats({
  stats,
}: {
  stats: {
    total: number;
    active: number;
    pending: number;
    users: number;
    gross: number;
    adminRevenue: number;
    instructorRevenue: number;
    pendingReview: number;
  };
}) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
      {[
        ["Courses", `${stats.active}/${stats.total} active`],
        ["Pending review", String(stats.pending)],
        ["Users", String(stats.users)],
        ["Offline to review", String(stats.pendingReview)],
      ].map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1 bg-card p-5">
          <dt className="kicker">{label}</dt>
          <dd className="font-heading text-2xl font-semibold">{value}</dd>
        </div>
      ))}
      <div className="col-span-2 flex flex-col gap-1 bg-card p-5 lg:col-span-4">
        <dt className="kicker">Revenue split (lifetime)</dt>
        <dd className="flex flex-wrap gap-6">
          <span className="font-heading text-xl font-semibold">
            Gross ${((stats.gross ?? 0) / 100).toFixed(2)}
          </span>
          <span className="font-heading text-xl font-semibold text-emerald-700 dark:text-emerald-400">
            Admin ${((stats.adminRevenue ?? 0) / 100).toFixed(2)}
          </span>
          <span className="font-heading text-xl font-semibold text-coral">
            Instructors ${((stats.instructorRevenue ?? 0) / 100).toFixed(2)}
          </span>
        </dd>
      </div>
    </dl>
  );
}
