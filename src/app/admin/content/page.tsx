import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { homePageConfigs } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HomeSectionsEditor, HomeSettingsForm } from "@/components/admin/home-settings";
import {
  CouponForm,
  CustomPageDeleteButton,
  CustomPageForm,
  DeleteRowButton,
  ModeratePostButtons,
} from "@/components/admin/controls";
import {
  listCouponsForAdmin,
  listCustomPagesForAdmin,
  listPendingPosts,
  listReviewsForAdmin,
  listSubscribers,
} from "@/server/queries/admin";
import { getFrontendSettings, getSystemSettings } from "@/lib/settings";
import { desc } from "drizzle-orm";
import { contactMessages } from "@/db/schema";
import { MarkContactReadButton } from "@/components/admin/contact-inbox";

export const metadata = { title: "Admin · Content" };

export default async function AdminContentPage() {
  const [reviews, pendingPosts, coupons, pages, subscribers, system, frontend, homeConfig] =
    await Promise.all([
      listReviewsForAdmin(),
      listPendingPosts(),
      listCouponsForAdmin(),
      listCustomPagesForAdmin(),
      listSubscribers(),
      getSystemSettings(),
      getFrontendSettings(),
      db
        .select()
        .from(homePageConfigs)
        .where(eq(homePageConfigs.identifier, "default"))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

  const inbox = await db
    .select()
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt))
    .limit(20);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="kicker">05 · Content & settings</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Content</h1>
      </header>

      <HomeSectionsEditor sections={homeConfig?.sections ?? []} />
      <HomeSettingsForm system={system} frontend={frontend} />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Contact inbox</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {inbox.length === 0 && <p className="text-muted-foreground text-sm">No messages.</p>}
          {inbox.map((message) => (
            <div
              key={message.id}
              className={`rounded-lg border p-3 text-sm ${message.hasRead ? "" : "bg-accent/40"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{message.name}</span>
                <span className="text-muted-foreground">{message.email}</span>
                {!message.hasRead && <MarkContactReadButton id={message.id} />}
              </div>
              <p className="text-muted-foreground mt-1">{message.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Pending blog posts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pendingPosts.length === 0 && (
              <p className="text-muted-foreground text-sm">Queue is clear.</p>
            )}
            {pendingPosts.map((post) => (
              <div key={post.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {post.title} <span className="text-muted-foreground">· {post.authorName}</span>
                </span>
                <ModeratePostButtons postId={post.id} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Reviews</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {reviews.length === 0 && <p className="text-muted-foreground text-sm">No reviews.</p>}
            {reviews.map((review) => (
              <div key={review.id} className="flex items-center gap-2 text-sm">
                <span className="text-amber-600 dark:text-amber-400">{"★".repeat(review.rating)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {review.courseTitle}{" "}
                  <span className="text-muted-foreground">· {review.userName}</span>
                </span>
                <DeleteRowButton kind="review" id={review.id} label="Delete review" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Coupons</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CouponForm />
            <ul className="flex flex-col gap-1.5 text-sm">
              {coupons.map((coupon) => (
                <li key={coupon.id} className="flex items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {coupon.code}
                  </code>
                  <span>{coupon.discountPercentage}% off</span>
                  {coupon.expiryDate && (
                    <span className="text-muted-foreground text-xs">
                      until {new Intl.DateTimeFormat("en", { dateStyle: "short" }).format(coupon.expiryDate)}
                    </span>
                  )}
                  <DeleteRowButton kind="coupon" id={coupon.id} label="Delete coupon" />
                </li>
              ))}
              {coupons.length === 0 && <p className="text-muted-foreground">None yet.</p>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Custom pages</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <CustomPageForm />
            {pages.map((page) => (
              <div key={page.id} className="flex items-center gap-2">
                <Link href={`/p/${page.url}`} className="text-coral font-medium hover:underline">
                  /p/{page.url}
                </Link>
                <span className="text-muted-foreground">· {page.title}</span>
                <span className="ml-auto">
                  <CustomPageDeleteButton id={page.id} />
                </span>
              </div>
            ))}
            {pages.length === 0 && (
              <p className="text-muted-foreground">No custom pages yet — create the first above.</p>
            )}
            <p className="text-muted-foreground text-xs">Subscribers: {subscribers.length}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
