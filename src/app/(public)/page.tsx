import { renderHomeSection } from "@/components/home/sections";
import { getFrontendSettings, getSystemSettings } from "@/lib/settings";
import { getActiveHomeConfig, getHomeSectionData } from "@/server/queries/home";

// Re-render at most every 60s — page-builder edits appear without a redeploy.
export const revalidate = 60;

export async function generateMetadata() {
  const { getSeoForRoute } = await import("@/lib/seo-meta");
  const seo = await getSeoForRoute("home");
  return seo ?? { title: "Academy LMS" };
}

export default async function HomePage() {
  const [config, data, system, frontend] = await Promise.all([
    getActiveHomeConfig(),
    getHomeSectionData(),
    getSystemSettings(),
    getFrontendSettings(),
  ]);

  const sections =
    config?.sections ?? [
      { type: "hero", props: {} },
      { type: "topCourses", props: {} },
      { type: "topCategories", props: {} },
      { type: "topInstructors", props: {} },
      { type: "testimonials", props: {} },
      { type: "faqPreview", props: {} },
      { type: "latestBlog", props: {} },
      { type: "becomeInstructor", props: {} },
    ];

  return (
    <>
      {sections.map((section) =>
        renderHomeSection(section, {
          currency: system,
          topCourses: data.topCourses,
          latestCourses: data.latestCourses,
          categoryTree: data.categoryTree,
          categoryCounts: data.categoryCounts,
          instructors: data.instructors,
          frontend,
          heroStats: data.heroStats,
          testimonials: data.testimonials,
          latestPosts: data.latestPosts,
        }),
      )}
    </>
  );
}
