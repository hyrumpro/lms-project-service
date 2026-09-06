import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adminPermissions,
  applications,
  categories,
  coupons,
  courses,
  customPages,
  enrollments,
  orders,
  payments,
  payouts,
  posts,
  reviews,
  subscribers,
  user,
} from "@/db/schema";

/** Admin queries — platform-wide lists and stats. */

export async function getAdminStats() {
  const [[courseStats], [userStats], [revenueStats], [orderStats]] = await Promise.all([
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${courses.status} = 'active')::int`,
        pending: sql<number>`count(*) filter (where ${courses.status} = 'pending')::int`,
      })
      .from(courses),
    db.select({ total: count() }).from(user),
    db
      .select({
        gross: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
        adminRevenue: sql<number>`coalesce(sum(${payments.adminRevenue}), 0)::int`,
        instructorRevenue: sql<number>`coalesce(sum(${payments.instructorRevenue}), 0)::int`,
      })
      .from(payments),
    db
      .select({
        pendingReview: sql<number>`count(*) filter (where ${orders.status} = 'pending_review')::int`,
      })
      .from(orders),
  ]);
  return { ...courseStats, users: userStats.total, ...revenueStats, ...orderStats };
}

export async function listAllCourses(status?: string) {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      status: courses.status,
      price: courses.price,
      isFree: courses.isFree,
      updatedAt: courses.updatedAt,
      instructorNames: sql<string>`(select coalesce(string_agg(u.name, ', '), '') from course_instructors ci join "user" u on u.id = ci.instructor_id where ci.course_id = ${courses.id})`,
      studentCount: sql<number>`(select count(*) from ${enrollments} e where e.course_id = ${courses.id})::int`,
      categoryName: categories.name,
    })
    .from(courses)
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .where(status ? eq(courses.status, status as "active") : sql`true`)
    .orderBy(desc(courses.updatedAt))
    .limit(100);
}

export async function listUsers() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isInstructor: user.isInstructor,
      status: user.status,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(100);
}

export async function listApplications() {
  return db
    .select({
      id: applications.id,
      status: applications.status,
      message: applications.message,
      createdAt: applications.createdAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(applications)
    .innerJoin(user, eq(user.id, applications.userId))
    .orderBy(desc(applications.createdAt))
    .limit(50);
}

export async function listOrdersForAdmin() {
  return db
    .select({
      id: orders.id,
      status: orders.status,
      total: orders.total,
      gateway: orders.gateway,
      giftToEmail: orders.giftToEmail,
      createdAt: orders.createdAt,
      userName: user.name,
      adminRevenue: payments.adminRevenue,
      instructorRevenue: payments.instructorRevenue,
    })
    .from(orders)
    .innerJoin(user, eq(user.id, orders.userId))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .orderBy(desc(orders.createdAt))
    .limit(100);
}

export async function listPayoutsForAdmin() {
  return db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      method: payouts.method,
      status: payouts.status,
      createdAt: payouts.createdAt,
      instructorName: user.name,
      instructorEmail: user.email,
    })
    .from(payouts)
    .innerJoin(user, eq(user.id, payouts.instructorId))
    .orderBy(desc(payouts.createdAt))
    .limit(50);
}

export async function listReviewsForAdmin() {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      review: reviews.review,
      createdAt: reviews.createdAt,
      userName: user.name,
      courseTitle: courses.title,
    })
    .from(reviews)
    .innerJoin(user, eq(user.id, reviews.userId))
    .innerJoin(courses, eq(courses.id, reviews.courseId))
    .orderBy(desc(reviews.createdAt))
    .limit(50);
}

export async function listCouponsForAdmin() {
  return db.select().from(coupons).orderBy(desc(coupons.createdAt));
}

export async function listCustomPagesForAdmin() {
  return db.select().from(customPages).orderBy(desc(customPages.createdAt));
}

export async function listSubscribers() {
  return db.select().from(subscribers).orderBy(desc(subscribers.createdAt)).limit(100);
}

export async function listPendingPosts() {
  return db
    .select({ id: posts.id, title: posts.title, status: posts.status, authorName: user.name })
    .from(posts)
    .innerJoin(user, eq(user.id, posts.authorId))
    .where(eq(posts.status, "pending"))
    .limit(50);
}

export async function listEnrollmentsForAdmin() {
  return db
    .select({
      id: enrollments.id,
      source: enrollments.source,
      createdAt: enrollments.createdAt,
      studentName: user.name,
      studentEmail: user.email,
      courseTitle: courses.title,
    })
    .from(enrollments)
    .innerJoin(user, eq(user.id, enrollments.userId))
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .orderBy(desc(enrollments.createdAt))
    .limit(50);
}

/** Admin section permission check (missing flag = allowed, default-open). */
export async function getAdminFlags(userId: string): Promise<Record<string, boolean>> {
  const [row] = await db
    .select({ flags: adminPermissions.flags })
    .from(adminPermissions)
    .where(eq(adminPermissions.userId, userId))
    .limit(1);
  return row?.flags ?? {};
}

export async function canAccessAdminSection(userId: string, section: string): Promise<boolean> {
  const flags = await getAdminFlags(userId);
  return flags[section] !== false;
}

export async function listAdminFlags() {
  return db.select().from(adminPermissions);
}
