/**
 * Local demo media, sourced from Pexels (free to use) and committed under
 * public/images. Seed data and the DB backfill both read from here so the
 * paths cannot drift apart.
 */

export const COURSE_IMAGES: Record<string, string> = {
  "Complete Web Development Bootcamp": "/images/courses/complete-web-development-bootcamp.jpg",
  "React from Scratch": "/images/courses/react-from-scratch.jpg",
  "Python for Data Analysis": "/images/courses/python-for-data-analysis.jpg",
  "Digital Marketing Masterclass": "/images/courses/digital-marketing-masterclass.jpg",
  "UI/UX Design Fundamentals": "/images/courses/uiux-design-fundamentals.jpg",
  "Intro to Personal Finance": "/images/courses/intro-to-personal-finance.jpg",
  "Flutter Mobile Development": "/images/courses/flutter-mobile-development.jpg",
  "Brand Identity Design": "/images/courses/brand-identity-design.jpg",
  "Learning How to Learn": "/images/courses/learning-how-to-learn.jpg",
};

/** Parent category name → cover image. */
export const CATEGORY_IMAGES: Record<string, string> = {
  Development: "/images/categories/development.jpg",
  Business: "/images/categories/business.jpg",
  Design: "/images/categories/design.jpg",
  "Data Science": "/images/categories/data-science.jpg",
  "Personal Development": "/images/categories/personal-development.jpg",
};

/** Instructor email → portrait. */
export const INSTRUCTOR_IMAGES: Record<string, string> = {
  "sarah@academy-next.test": "/images/instructors/sarah-chen.jpg",
  "miguel@academy-next.test": "/images/instructors/miguel-santos.jpg",
  "elena@academy-next.test": "/images/instructors/elena-petrova.jpg",
};
