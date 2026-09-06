import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  account,
  categories,
  coupons,
  courseInstructors,
  courseProgress,
  courses,
  enrollments,
  gatewayConfigs,
  homePageConfigs,
  lessonProgress,
  lessons,
  liveClasses,
  messageThreads,
  messages,
  notifications,
  plans,
  postCategories,
  postComments,
  posts,
  questions,
  certificate,
  quizzes,
  reviews,
  subscriptions,
  sections,
  session,
  settings,
  resourceFiles,
  user,
  wishlistItems,
} from "@/db/schema";
import { slugify } from "@/lib/slug";

/**
 * Dev seed — wipes and repopulates demo data (spec §7.2–7.4).
 * Run: npm run db:seed
 */

const PASSWORD = "SuperSecret123!";

async function makeUser(opts: {
  email: string;
  firstName: string;
  lastName: string;
  title?: string;
  biography?: string;
  role?: "student" | "admin";
  isInstructor?: boolean;
}) {
  const ctx = await auth.$context;
  const id = crypto.randomUUID();
  await db.insert(user).values({
    id,
    name: `${opts.firstName} ${opts.lastName}`,
    email: opts.email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    firstName: opts.firstName,
    lastName: opts.lastName,
    title: opts.title,
    biography: opts.biography,
    role: opts.role ?? "student",
    isInstructor: opts.isInstructor ?? false,
    status: "active",
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    issuer: "local:credential",
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await ctx.password.hash(PASSWORD),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

async function wipe() {
  // FK-safe order
  for (const table of [
    session,
    account,
    user,
    gatewayConfigs,
    coupons,
    liveClasses,
    messages,
    messageThreads,
    notifications,
    wishlistItems,
    postComments,
    posts,
    postCategories,
    questions,
    quizzes,
    lessonProgress,
    reviews,
    enrollments,
    courseProgress,
    lessons,
    sections,
    courseInstructors,
    courses,
    categories,
    homePageConfigs,
    settings,
  ]) {
    await db.delete(table);
  }
}

const YT = "https://www.youtube.com/watch?v=";

async function main() {
  console.log("Seeding…");
  await wipe();

  // ── users ──────────────────────────────────────────────────────────────
  const adminId = await makeUser({
    email: "admin@academy-next.test",
    firstName: "Ava",
    lastName: "Admin",
    role: "admin",
    biography: "Platform administrator.",
  });
  const sarahId = await makeUser({
    email: "sarah@academy-next.test",
    firstName: "Sarah",
    lastName: "Chen",
    title: "Product Designer & Front-end Dev",
    biography: "12 years designing and building interfaces. Ex-Stripe.",
    isInstructor: true,
  });
  const miguelId = await makeUser({
    email: "miguel@academy-next.test",
    firstName: "Miguel",
    lastName: "Santos",
    title: "Full-stack Engineer",
    biography: "Ships web and mobile apps; React and Flutter specialist.",
    isInstructor: true,
  });
  const elenaId = await makeUser({
    email: "elena@academy-next.test",
    firstName: "Elena",
    lastName: "Petrova",
    title: "Growth Marketer",
    biography: "Scaled three startups past 1M users.",
    isInstructor: true,
  });
  const johnId = await makeUser({ email: "john@academy-next.test", firstName: "John", lastName: "Doe" });
  const mariaId = await makeUser({ email: "maria@academy-next.test", firstName: "Maria", lastName: "Lopez" });

  // ── settings + home config ────────────────────────────────────────────
  await db.insert(settings).values([
    {
      key: "system",
      value: {
        name: "Academy LMS",
        title: "Academy LMS",
        timezone: "UTC",
        currencyCode: "USD",
        currencySymbol: "$",
        currencyPosition: "left",
        instructorRevenuePercent: 70,
        courseSellingTax: 0,
      },
    },
    {
      key: "frontend",
      value: {
        heroTitle: "Learn anything. Anywhere.",
        heroSubTitle: "Premium courses taught by world-class instructors — start with a free course today.",
        footerText: "© Academy LMS. All rights reserved.",
      },
    },
  ]);

  await db.insert(gatewayConfigs).values([
    { identifier: "mock", title: "Sandbox Bank (demo)", enabled: true, testMode: true },
    { identifier: "offline", title: "Bank transfer", enabled: true, testMode: false },
    { identifier: "stripe", title: "Stripe", enabled: false, testMode: true },
    { identifier: "paypal", title: "PayPal", enabled: false, testMode: true },
    { identifier: "razorpay", title: "Razorpay", enabled: false, testMode: true },
  ]);

  await db.insert(coupons).values([
    { code: "WELCOME10", discountPercentage: 10 },
    { code: "STUDENT25", discountPercentage: 25 },
    { code: "FREE100", discountPercentage: 100 },
  ]);


  await db.insert(homePageConfigs).values({
    identifier: "default",
    title: "Default home",
    description: "Hero + categories + top courses + instructors",
    isActive: true,
    sections: [
      { type: "hero", props: {} },
      { type: "topCategories", props: {} },
      { type: "topCourses", props: {} },
      { type: "topInstructors", props: {} },
    ],
  });

  // ── categories ────────────────────────────────────────────────────────
  const catDefs = [
    { name: "Development", children: ["Web Development", "Mobile Development"] },
    { name: "Business", children: ["Marketing"] },
    { name: "Design", children: ["Graphic Design", "UI/UX Design"] },
    { name: "Data Science", children: [] },
    { name: "Personal Development", children: [] },
  ];
  const catIds = new Map<string, string>();
  let order = 0;
  for (const def of catDefs) {
    const [parent] = await db
      .insert(categories)
      .values({ id: crypto.randomUUID(), name: def.name, slug: slugify(def.name), order: order++ })
      .returning({ id: categories.id });
    catIds.set(def.name, parent.id);
    for (const child of def.children) {
      const [sub] = await db
        .insert(categories)
        .values({
          id: crypto.randomUUID(),
          parentId: parent.id,
          name: child,
          slug: slugify(child),
          order: order++,
        })
        .returning({ id: categories.id });
      catIds.set(child, sub.id);
    }
  }

  // ── courses ───────────────────────────────────────────────────────────
  type CourseDef = {
    title: string;
    shortDescription: string;
    categoryId: string;
    instructorId: string;
    isFree?: boolean;
    price?: number;
    discountEnabled?: boolean;
    discountedPrice?: number;
    level?: string;
    isTopCourse?: boolean;
    enableDripContent?: boolean;
    promo?: { provider: "youtube" | "vimeo" | "html5"; url: string };
    outcomes: string[];
    requirements: string[];
    faqs: { question: string; answer: string }[];
    sections: {
      title: string;
      unlockRule?: import("@/db/schema").UnlockRule;
      lessons: (
        | { title: string; kind: "video"; provider?: "youtube" | "html5"; yt?: string; mp4?: string; free?: boolean; duration: number }
        | { title: string; kind: "text"; body: string; free?: boolean }
        | { title: string; kind: "quiz"; questions: { title: string; type: "single_choice" | "multiple_choice" | "fill_in_the_blank"; options: string[]; correct: string[] }[] }
      )[];
    }[];
  };

  const courseDefs: CourseDef[] = [
    {
      title: "Complete Web Development Bootcamp",
      promo: { provider: "youtube", url: "M7lc1UVf-VE" },
      shortDescription: "HTML, CSS and JavaScript from zero to your first deployed website.",
      categoryId: catIds.get("Web Development")!,
      instructorId: sarahId,
      price: 4999,
      level: "beginner",
      isTopCourse: true,
      outcomes: [
        "Build responsive websites from scratch",
        "Write modern, semantic HTML and CSS",
        "Program interactive features with JavaScript",
        "Deploy your site to the web",
      ],
      requirements: ["A computer with internet access", "No prior coding experience needed"],
      faqs: [
        { question: "Do I need to buy any software?", answer: "No — we use free, open-source tools only." },
        { question: "How long do I have access?", answer: "Forever, including future updates." },
      ],
      sections: [
        {
          title: "Introduction",
          lessons: [
            { title: "Welcome to the bootcamp", kind: "video", yt: "W6NZfCO5SIk", free: true, duration: 384 },
            { title: "How to get the most out of this course", kind: "text", body: "<p>Watch one section at a time and code along.</p>" },
            { title: "Setting up your editor", kind: "video", yt: "jrBhi8hNBnE", duration: 640 },
          ],
        },
        {
          title: "HTML & CSS Foundations",
          lessons: [
            { title: "Your first HTML page", kind: "video", yt: "qz0aGYrrlhU", duration: 720 },
            { title: "Styling with CSS", kind: "video", yt: "1Rs2ND1ryYc", duration: 905 },
            { title: "Flexbox layout", kind: "video", yt: "qTYw7hcpSc4", duration: 540 },
            { title: "Responsive design", kind: "video", yt: "fgOPE9LA0Z8", duration: 655 },
          ],
        },
        {
          title: "Practice Footage",
          lessons: [
            {
              title: "Camera movement analysis: Big Buck Bunny",
              kind: "video",
              provider: "html5",
              mp4: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
              free: true,
              duration: 596,
            },
            {
              title: "Quick cut exercise (60s clip — finishes fast!)",
              kind: "video",
              provider: "html5",
              mp4: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
              duration: 60,
            },
            {
              title: "Scene study: Elephants Dream",
              kind: "video",
              provider: "html5",
              mp4: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
              duration: 653,
            },
          ],
        },
        {
          title: "JavaScript Basics",
          lessons: [
            { title: "Variables and types", kind: "video", yt: "W6NZfCO5SIk", duration: 610 },
            { title: "Functions and scope", kind: "video", yt: "hdI2bqOjy3c", duration: 590 },
            {
              title: "JavaScript Fundamentals Check",
              kind: "quiz",
              questions: [
                { title: "Which keyword declares a block-scoped variable?", type: "single_choice", options: ["var", "let", "function"], correct: ["let"] },
                { title: "Select all primitive types", type: "multiple_choice", options: ["string", "array", "number", "object"], correct: ["string", "number"] },
                { title: "typeof [] returns ____", type: "fill_in_the_blank", options: [], correct: ["object"] },
              ],
            },
          ],
        },
      ],
    },
    {
      title: "React from Scratch",
      promo: { provider: "youtube", url: "SqcY0GlETPk" },
      shortDescription: "Components, state and hooks — build your first React app.",
      categoryId: catIds.get("Web Development")!,
      instructorId: miguelId,
      price: 2999,
      discountEnabled: true,
      discountedPrice: 1999,
      level: "intermediate",
      isTopCourse: true,
      outcomes: ["Think in components", "Manage state with hooks", "Fetch and render data"],
      requirements: ["Comfortable with JavaScript"],
      faqs: [{ question: "Next.js included?", answer: "The patterns transfer directly to Next.js." }],
      sections: [
        {
          title: "Getting Started",
          lessons: [
            { title: "Why React?", kind: "video", yt: "Tn6-PIqc4UM", free: true, duration: 420 },
            { title: "Your first component", kind: "video", yt: "SqcY0GlETPk", duration: 680 },
          ],
        },
        {
          title: "State & Hooks",
          lessons: [
            { title: "useState in depth", kind: "video", yt: "O6P86uwfdR0", duration: 700 },
            { title: "useEffect and data fetching", kind: "video", yt: "0ZJgIjIuY7U", duration: 760 },
          ],
        },
        {
          title: "Watch & Compare (sample footage)",
          lessons: [
            { title: "Component walkthrough on screen", kind: "video", provider: "html5", mp4: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", free: true, duration: 15 },
            { title: "Code review session", kind: "video", provider: "html5", mp4: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", duration: 15 },
          ],
        },
      ],
    },
    {
      title: "Python for Data Analysis",
      promo: { provider: "youtube", url: "vmEHCJofslg" },
      shortDescription: "Pandas, NumPy and real datasets — analyze data with confidence.",
      categoryId: catIds.get("Data Science")!,
      instructorId: miguelId,
      price: 3999,
      level: "intermediate",
      outcomes: ["Load and clean datasets with pandas", "Compute descriptive statistics", "Build clear visualizations"],
      requirements: ["Basic programming helps"],
      faqs: [],
      sections: [
        {
          title: "Python Refresher",
          lessons: [
            { title: "Lists, dicts and comprehensions", kind: "video", yt: "rfscVS0vtbw", free: true, duration: 800 },
            { title: "Notebook setup", kind: "text", body: "<p>Install Python, pandas and matplotlib.</p>" },
          ],
        },
        {
          title: "Pandas in Practice",
          lessons: [
            { title: "DataFrames 101", kind: "video", yt: "vmEHCJofslg", duration: 850 },
            { title: "Group-by and aggregation", kind: "video", yt: "txM7eVPJQC8", duration: 720 },
          ],
        },
      ],
    },
    {
      title: "Digital Marketing Masterclass",
      promo: { provider: "youtube", url: "nU-IIXBWlS4" },
      shortDescription: "SEO, social and email — a full-funnel growth playbook.",
      categoryId: catIds.get("Marketing")!,
      instructorId: elenaId,
      price: 3999,
      level: "beginner",
      isTopCourse: true,
      outcomes: ["Plan a full-funnel campaign", "Rank content with SEO basics", "Write emails people open"],
      requirements: [],
      faqs: [{ question: "Is ad spend required?", answer: "No — every tactic has an organic version." }],
      sections: [
        {
          title: "Foundations",
          lessons: [
            { title: "The growth funnel", kind: "video", yt: "nU-IIXBWlS4", free: true, duration: 460 },
            { title: "Positioning exercise", kind: "text", body: "<p>Write your one-sentence positioning.</p>" },
          ],
        },
        {
          title: "Channels",
          lessons: [
            { title: "SEO that compounds", kind: "video", yt: "xsSTqGR4jB4", duration: 780 },
            { title: "Email sequences", kind: "video", yt: "tDWscsA0Lt0", duration: 640 },
          ],
        },
      ],
    },
    {
      title: "UI/UX Design Fundamentals",
      promo: { provider: "youtube", url: "aVUOrsAYhfs" },
      shortDescription: "Layout, type, color and usability — design screens people love.",
      categoryId: catIds.get("UI/UX Design")!,
      instructorId: sarahId,
      price: 3499,
      level: "beginner",
      enableDripContent: true,
      outcomes: ["Apply visual hierarchy", "Build a simple design system", "Run a quick usability test"],
      requirements: [],
      faqs: [],
      sections: [
        {
          title: "Visual Design",
          lessons: [
            { title: "Hierarchy and spacing", kind: "video", yt: "aVUOrsAYhfs", free: true, duration: 560 },
            { title: "Typography that works", kind: "video", yt: "sZ9ZAc6MhOs", duration: 690 },
          ],
        },
        {
          title: "UX Process",
          unlockRule: { kind: "prevSection" },
          lessons: [
            { title: "Wireframing flows", kind: "video", yt: "68VpijZi7Y0", duration: 610 },
          ],
        },
      ],
    },
    {
      title: "Intro to Personal Finance",
      promo: { provider: "youtube", url: "FZ7aWpFkN5A" },
      shortDescription: "Budgeting, saving and investing basics — completely free.",
      categoryId: catIds.get("Personal Development")!,
      instructorId: elenaId,
      isFree: true,
      level: "beginner",
      outcomes: ["Build a monthly budget", "Understand compound interest", "Start investing safely"],
      requirements: [],
      faqs: [{ question: "Is it really free?", answer: "Yes — 100% free, forever." }],
      sections: [
        {
          title: "Money Basics",
          lessons: [
            { title: "Where does the money go?", kind: "video", yt: "SuG-cUvEfzE", free: true, duration: 500 },
            { title: "The 50/30/20 budget", kind: "video", yt: "HQzoZfc3GwQ", duration: 480 },
          ],
        },
        {
          title: "Growing Your Money",
          lessons: [
            { title: "Compound interest explained", kind: "video", yt: "FZ7aWpFkN5A", duration: 540 },
            { title: "Case study: first 1000 saved (native player)", kind: "video", provider: "html5", mp4: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4", duration: 15 },
            { title: "Budget template walkthrough (native player)", kind: "video", provider: "html5", mp4: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4", duration: 15 },
          ],
        },
      ],
    },
    {
      title: "Flutter Mobile Development",
      promo: { provider: "youtube", url: "b_sQ9jMSA_T" },
      shortDescription: "Build and ship cross-platform apps with Flutter and Dart.",
      categoryId: catIds.get("Mobile Development")!,
      instructorId: miguelId,
      price: 4499,
      level: "intermediate",
      outcomes: ["Write Dart fluently", "Build Flutter UIs", "Publish to app stores"],
      requirements: ["Basic programming experience"],
      faqs: [],
      sections: [
        {
          title: "Dart & Flutter Basics",
          lessons: [
            { title: "Why Flutter?", kind: "video", yt: "b_sQ9jMSA_T", free: true, duration: 450 },
            { title: "Widgets everywhere", kind: "video", yt: "b_sQ9jMSA_T", duration: 700 },
          ],
        },
      ],
    },
    {
      title: "Brand Identity Design",
      promo: { provider: "youtube", url: "dWE8ieWbXoo" },
      shortDescription: "Logos, palettes and guidelines — craft a memorable brand.",
      categoryId: catIds.get("Graphic Design")!,
      instructorId: sarahId,
      price: 2499,
      level: "beginner",
      outcomes: ["Design a logo system", "Choose accessible palettes", "Write brand guidelines"],
      requirements: [],
      faqs: [],
      sections: [
        {
          title: "Brand Foundations",
          lessons: [
            { title: "What is a brand?", kind: "video", yt: "dWE8ieWbXoo", free: true, duration: 400 },
            { title: "Moodboarding", kind: "text", body: "<p>Collect 20 references before drawing anything.</p>" },
          ],
        },
      ],
    },
    {
      title: "Learning How to Learn",
      promo: { provider: "youtube", url: "Z-zNBHpF0b0" },
      shortDescription:
        "A free mini-course on memory, focus and practice — released section by section (drip content demo).",
      categoryId: catIds.get("Personal Development")!,
      instructorId: elenaId,
      isFree: true,
      level: "beginner",
      enableDripContent: true,
      outcomes: [
        "Use spaced repetition effectively",
        "Build a focused practice routine",
        "Beat the forgetting curve",
      ],
      requirements: [],
      faqs: [
        {
          question: "Why do sections unlock over time?",
          answer:
            "Spacing is part of the pedagogy — new sections open after a couple of days so your practice settles first.",
        },
      ],
      sections: [
        {
          title: "Day One — The Two Modes of Thinking",
          unlockRule: undefined,
          lessons: [
            { title: "Focus vs. diffuse thinking", kind: "video", yt: "Z-zNBHpF0b0", free: true, duration: 420 },
            { title: "Set up your practice log", kind: "text", body: "<p>Grab a notebook. One page per day, one sentence per session.</p>" },
          ],
        },
        {
          title: "Deep Practice (opens in 2 days)",
          unlockRule: { kind: "daysAfterEnroll", days: 2 },
          lessons: [
            { title: "Chunks: how skills actually form", kind: "video", yt: "1r8zjBITai4", duration: 510 },
            { title: "Deliberate practice checklist", kind: "text", body: "<p>Pick one weak skill. Do 3 focused 25-minute sessions this week.</p>" },
          ],
        },
        {
          title: "Mastery Habits (after Deep Practice)",
          unlockRule: { kind: "prevSection" },
          lessons: [
            { title: "Spaced repetition in 10 minutes", kind: "video", yt: "V-UvSKe8jW4", duration: 600 },
          ],
        },
      ],
    },
  ];

  let courseIndex = 0;
  for (const def of courseDefs) {
    courseIndex += 1;
    const courseId = crypto.randomUUID();
    await db.insert(courses).values({
      id: courseId,
      title: def.title,
      slug: slugify(def.title),
      shortDescription: def.shortDescription,
      description: `<p>${def.shortDescription}</p>`,
      outcomes: def.outcomes,
      requirements: def.requirements,
      faqs: def.faqs,
      language: "English",
      level: def.level ?? "beginner",
      categoryId: def.categoryId,
      status: "active",
      isFree: def.isFree ?? false,
      price: def.price ?? 0,
      discountEnabled: def.discountEnabled ?? false,
      discountedPrice: def.discountedPrice ?? 0,
      isTopCourse: def.isTopCourse ?? false,
      createdByAdmin: true,
      enableDripContent: def.enableDripContent ?? false,
      promoVideoProvider: def.promo?.provider ?? null,
      promoVideoUrl: def.promo ? (def.promo.provider === "youtube" ? "https://www.youtube.com/watch?v=" + def.promo.url : def.promo.url) : null,
      publishDate: new Date(Date.now() - courseIndex * 86_400_000 * 7),
    });
    await db.insert(courseInstructors).values({
      courseId,
      instructorId: def.instructorId,
      isOwner: true,
    });

    let sectionOrder = 0;
    for (const sectionDef of def.sections) {
      const sectionId = crypto.randomUUID();
      await db.insert(sections).values({
        id: sectionId,
        courseId,
        title: sectionDef.title,
        order: sectionOrder++,
        unlockRule: sectionDef.unlockRule ?? null,
      });

      let lessonOrder = 0;
      for (const lessonDef of sectionDef.lessons) {
        const lessonId = crypto.randomUUID();
        if (lessonDef.kind === "video") {
          await db.insert(lessons).values({
            id: lessonId,
            courseId,
            sectionId,
            title: lessonDef.title,
            order: lessonOrder++,
            type: "video",
            videoProvider: lessonDef.provider === "html5" ? "html5" : "youtube",
            videoUrl: lessonDef.provider === "html5" ? lessonDef.mp4 : YT + lessonDef.yt,
            isFreePreview: lessonDef.free ?? false,
            durationSeconds: lessonDef.duration,
          });
        } else if (lessonDef.kind === "text") {
          await db.insert(lessons).values({
            id: lessonId,
            courseId,
            sectionId,
            title: lessonDef.title,
            order: lessonOrder++,
            type: "text",
            summary: lessonDef.body,
            isFreePreview: lessonDef.free ?? false,
          });
        } else {
          await db.insert(lessons).values({
            id: lessonId,
            courseId,
            sectionId,
            title: lessonDef.title,
            order: lessonOrder++,
            type: "quiz",
            quizMaxAttempts: 3,
          });
          const [quiz] = await db
            .insert(quizzes)
            .values({ id: crypto.randomUUID(), lessonId })
            .returning({ id: quizzes.id });
          let qOrder = 0;
          for (const q of lessonDef.questions) {
            await db.insert(questions).values({
              id: crypto.randomUUID(),
              quizId: quiz.id,
              title: q.title,
              type: q.type,
              numberOfOptions: q.options.length,
              options: q.options,
              correctAnswers: q.correct,
              order: qOrder++,
            });
          }
        }
      }
    }
  }

  // ── resource files (attachments demo) ──
  await db.insert(resourceFiles).values([
    { id: crypto.randomUUID(), lessonId: (await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.title, 'Welcome to the bootcamp')).limit(1))[0].id, title: 'Course roadmap (PDF)', file: '/api/files/uploads/resource_files/academy-roadmap.txt' },
    { id: crypto.randomUUID(), lessonId: (await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.title, 'Flexbox layout')).limit(1))[0].id, title: 'Flexbox cheat sheet', file: '/api/files/uploads/resource_files/flexbox-cheatsheet.txt' },
    { id: crypto.randomUUID(), lessonId: (await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.title, 'Where does the money go?')).limit(1))[0].id, title: 'Monthly budget template', file: '/api/files/uploads/resource_files/budget-template.txt' },
  ]);

  // ── enrollments + reviews ─────────────────────────────────────────────
  const courseRows = await db.select({ id: courses.id, title: courses.title }).from(courses);
  const byTitle = (title: string) => courseRows.find((c) => c.title === title)!.id;

  await db.insert(enrollments).values([
    { userId: adminId, courseId: byTitle("Intro to Personal Finance"), source: "free" as const },
    { userId: johnId, courseId: byTitle("Complete Web Development Bootcamp"), source: "purchase" as const },
    { userId: johnId, courseId: byTitle("React from Scratch"), source: "purchase" as const },
    { userId: mariaId, courseId: byTitle("Complete Web Development Bootcamp"), source: "purchase" as const },
    { userId: mariaId, courseId: byTitle("Digital Marketing Masterclass"), source: "purchase" as const },
    { userId: mariaId, courseId: byTitle("UI/UX Design Fundamentals"), source: "purchase" as const },
    { userId: johnId, courseId: byTitle("Intro to Personal Finance"), source: "free" as const },
    // drip-content demo: john enrolled in "Learning How to Learn" just now
    {
      userId: johnId,
      courseId: byTitle("Learning How to Learn"),
      source: "free" as const,
    },
    // expiry demo: john's Flutter enrollment lapsed yesterday
    {
      userId: johnId,
      courseId: byTitle("Flutter Mobile Development"),
      source: "purchase" as const,
      expiresAt: new Date(Date.now() - 86_400_000),
    },
  ]);

  await db.insert(courseProgress).values([
    { userId: adminId, courseId: byTitle("Intro to Personal Finance") },
    {
      userId: johnId,
      courseId: byTitle("Complete Web Development Bootcamp"),
      percent: 45,
      completedLessons: 4,
    },
    { userId: mariaId, courseId: byTitle("Complete Web Development Bootcamp") },
  ]);

  // john has watched the first 4 lessons of the bootcamp
  const bootcampId = byTitle("Complete Web Development Bootcamp");
  const bootcampLessons = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.courseId, bootcampId))
    .orderBy(lessons.order);
  for (const lesson of bootcampLessons.slice(0, 4)) {
    await db.insert(lessonProgress).values({
      userId: johnId,
      lessonId: lesson.id,
      isCompleted: true,
      lastPositionSeconds: 300,
      watchCount: 2,
    });
  }
  if (bootcampLessons[4]) {
    await db
      .update(courseProgress)
      .set({ watchingLessonId: bootcampLessons[4].id })
      .where(and(eq(courseProgress.userId, johnId), eq(courseProgress.courseId, bootcampId)));
  }

  // ── subscription plans ──
  const planDefs = [
    { name: 'Starter', description: 'For casual learners.', price: 900, interval: 'month' as const, features: ['All free + top courses', 'Progress tracking', 'Certificates'], sortOrder: 1 },
    { name: 'Pro', description: 'Serious skills, one price.', price: 1900, interval: 'month' as const, features: ['Everything in Starter', 'All courses included', 'Priority Q&A responses', 'Downloadable resources'], sortOrder: 2 },
    { name: 'All-Access Yearly', description: 'Best value — two months free.', price: 19900, interval: 'year' as const, features: ['Everything in Pro', 'Two months free vs monthly', 'Early access to new courses'], sortOrder: 3 },
  ];
  const planIds: string[] = [];
  for (const def of planDefs) {
    const [row] = await db
      .insert(plans)
      .values({
        id: crypto.randomUUID(),
        name: def.name,
        slug: slugify(def.name),
        description: def.description,
        price: def.price,
        interval: def.interval,
        features: def.features,
        isActive: true,
        sortOrder: def.sortOrder,
      })
      .onConflictDoNothing()
      .returning({ id: plans.id });
    if (row) planIds.push(row.id);
  }
  // give maria the Pro plan so /dashboard/subscription has content
  if (planIds[1]) {
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      userId: mariaId,
      planId: planIds[1],
      status: 'active',
      gateway: 'mock',
      transactionId: 'SUB-DEMO',
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    });
  }

  // demo certificate (verify at /certificate/AC-DEMO1-TEST1, PDF at /api/certificate/AC-DEMO1-TEST1/pdf)
  await db
    .insert(certificate)
    .values({
      code: 'AC-DEMO1-TEST1',
      studentId: mariaId,
      courseId: byTitle('Intro to Personal Finance'),
    })
    .onConflictDoNothing();

  // ── blog ───────────────────────────────────────────────────────────────
  const catDesign = (
    await db
      .insert(postCategories)
      .values({ id: crypto.randomUUID(), title: "Teaching & Learning", slug: "teaching-learning" })
      .returning({ id: postCategories.id })
  )[0];
  const catProduct = (
    await db
      .insert(postCategories)
      .values({ id: crypto.randomUUID(), title: "Product Updates", slug: "product-updates" })
      .returning({ id: postCategories.id })
  )[0];

  const postSeeds = [
    {
      categoryId: catDesign.id,
      authorId: sarahId,
      title: "Why we teach CSS layout before frameworks",
      slug: "why-we-teach-css-layout-before-frameworks",
      isPopular: true,
      description:
        "Frameworks come and go, but the box model is forever. Our approach to sequencing front-end fundamentals — and why students who learn layout first adopt React faster.",
      keywords: "css, teaching, front-end",
    },
    {
      categoryId: catDesign.id,
      authorId: miguelId,
      title: "The 45-minute rule for video lessons",
      slug: "the-45-minute-rule-for-video-lessons",
      isPopular: false,
      description:
        "We analyzed watch-through data across our catalog: lessons that respect attention spans keep students moving. Here's how we structure sections now.",
      keywords: "video, engagement",
    },
    {
      categoryId: catProduct.id,
      authorId: elenaId,
      title: "Academy rebuilds in Next.js — what changes for you",
      slug: "academy-rebuilds-in-nextjs",
      isPopular: false,
      description:
        "A faster catalog, dark mode, wishlist, and a modern dashboard. A short tour of what shipped in milestones M0–M2 and what lands next.",
      keywords: "product, nextjs",
    },
  ];
  const postIds: { id: string; slug: string }[] = [];
  for (const post of postSeeds) {
    const [row] = await db
      .insert(posts)
      .values({
        id: crypto.randomUUID(),
        title: post.title,
        slug: post.slug,
        categoryId: post.categoryId,
        authorId: post.authorId,
        description: `<p>${post.description}</p><h2>How it works</h2><p>We start with the fundamentals, add practice early, and keep every lesson under an hour. <a href="/courses">Browse the catalog</a> to see it in practice.</p>`,
        isPopular: post.isPopular,
        status: "published",
        keywords: post.keywords,
        publishedAt: new Date(Date.now() - postSeeds.indexOf(post) * 86_400_000 * 3),
      })
      .returning({ id: posts.id, slug: posts.slug });
    postIds.push(row);
  }

  await db.insert(postComments).values([
    {
      postId: postIds[0].id,
      userId: mariaId,
      body: "This mirrors my experience — flexbox first made React click for me later.",
    },
    {
      postId: postIds[0].id,
      userId: johnId,
      body: "Any chance of a follow-up on grid layouts?",
    },
  ]);

  // ── wishlist, notifications, messages ─────────────────────────────────
  await db.insert(wishlistItems).values([
    { userId: mariaId, courseId: byTitle("React from Scratch") },
    { userId: mariaId, courseId: byTitle("Flutter Mobile Development") },
    { userId: johnId, courseId: byTitle("UI/UX Design Fundamentals") },
  ]);

  await db.insert(notifications).values([
    {
      userId: johnId,
      type: "system_welcome",
      title: "Welcome to Academy!",
      body: "Your account is ready. Free courses are a great place to start.",
      url: "/courses?price=free",
      createdAt: new Date(Date.now() - 86_400_000 * 5),
    },
    {
      userId: johnId,
      type: "course_enrolled",
      title: "You're enrolled: Complete Web Development Bootcamp",
      body: "Jump back in — you're 45% of the way through.",
      url: "/dashboard/my-courses",
      createdAt: new Date(Date.now() - 86_400_000 * 2),
    },
    {
      userId: johnId,
      type: "course_enrolled",
      title: "You're enrolled: Intro to Personal Finance",
      body: "A free course on us. Budgeting starts here.",
      url: "/dashboard/my-courses",
    },
  ]);

  const threadId = crypto.randomUUID();
  await db.insert(messageThreads).values({
    id: threadId,
    threadCode: `TH-${threadId.slice(0, 8).toUpperCase()}`,
    senderId: johnId,
    receiverId: sarahId,
    lastMessageAt: new Date(Date.now() - 3_600_000),
  });
  const [thread] = await db
    .select({ id: messageThreads.id, threadCode: messageThreads.threadCode })
    .from(messageThreads)
    .where(eq(messageThreads.id, threadId));
  await db.insert(messages).values([
    {
      threadId: thread.id,
      senderId: johnId,
      body: "Hi Sarah! Loving the bootcamp — is the flexbox lesson getting a practice file?",
      createdAt: new Date(Date.now() - 7_200_000),
    },
    {
      threadId: thread.id,
      senderId: sarahId,
      body: "Hi John! Yes — shipping this week. I'll add it to the lesson attachments.",
      createdAt: new Date(Date.now() - 3_600_000),
    },
  ]);

  await db.insert(reviews).values([
    { userId: johnId, courseId: byTitle("Complete Web Development Bootcamp"), rating: 5, review: "Sarah explains everything clearly. Best intro course I've taken." },
    { userId: mariaId, courseId: byTitle("Complete Web Development Bootcamp"), rating: 4, review: "Great content — would love more exercises." },
    { userId: mariaId, courseId: byTitle("Digital Marketing Masterclass"), rating: 5, review: "Actionable from lesson one." },
    { userId: johnId, courseId: byTitle("React from Scratch"), rating: 4, review: "Solid hooks coverage." },
  ]);

  const counts = await db.select().from(courses);
  console.log(`Seed complete: ${counts.length} courses.`);
  console.log("Logins (password: %s):", PASSWORD);
  console.log("  admin@academy-next.test (admin)");
  console.log("  sarah@academy-next.test / miguel@academy-next.test / elena@academy-next.test (instructors)");
  console.log("  john@academy-next.test / maria@academy-next.test (students)");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
