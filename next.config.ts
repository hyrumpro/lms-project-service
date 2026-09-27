import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/**
 * Legacy URL redirects (spec §6, M8) — every Academy v7.1 public URL pattern
 * maps to its Next equivalent so bookmarks and search rankings survive cutover.
 */
async function redirects() {
  return [
    // course detail: /home/course/{slug}/{id} → /course/{slug}-{id}
    {
      source: "/home/course/:slug/:id",
      destination: "/course/:slug-:id",
      permanent: true,
    },
    // catalog: /home/courses (± trailing params preserved by Next automatically)
    { source: "/home/courses", destination: "/courses", permanent: true },
    { source: "/courses/all", destination: "/courses", permanent: true },
    // player: /home/lesson/{slug}/{courseId}/{lessonId} → /learn/{courseId}/{lessonId}
    {
      source: "/home/lesson/:slug/:courseId/:lessonId",
      destination: "/learn/:courseId/:lessonId",
      permanent: true,
    },
    // instructor page: /home/instructor_page/{id}
    { source: "/home/instructor_page/:id", destination: "/instructor/:id", permanent: true },
    // student pages
    { source: "/home/my_courses", destination: "/dashboard/my-courses", permanent: true },
    { source: "/home/my_wishlist", destination: "/dashboard/wishlist", permanent: true },
    { source: "/home/purchase_history", destination: "/dashboard/purchases", permanent: true },
    { source: "/home/shopping_cart", destination: "/dashboard/shopping-cart", permanent: true },
    { source: "/home/profile", destination: "/dashboard/profile", permanent: true },
    { source: "/home/my_messages", destination: "/dashboard/messages", permanent: true },
    { source: "/home/my_notifications", destination: "/dashboard/notifications", permanent: true },
    { source: "/home/badges", destination: "/dashboard", permanent: true },
    // auth
    { source: "/login", destination: "/sign-in", permanent: true },
    { source: "/home/login", destination: "/sign-in", permanent: true },
    { source: "/home/sign_up", destination: "/sign-up", permanent: true },
    { source: "/home/forgot_password", destination: "/forgot-password", permanent: true },
    // content
    { source: "/blogs", destination: "/blog", permanent: true },
    { source: "/blogs/:slug", destination: "/blog/:slug", permanent: true },
    { source: "/home/about_us", destination: "/about", permanent: true },
    { source: "/home/faq", destination: "/faq", permanent: true },
    { source: "/home/contact_us", destination: "/contact", permanent: true },
    // legacy addon routes → catalog
    { source: "/course_bundles", destination: "/bundles", permanent: true },
    { source: "/ebook", destination: "/ebooks", permanent: true },
  ];
}

const nextConfig: NextConfig = {
  redirects,
};

export default withNextIntl(nextConfig);
