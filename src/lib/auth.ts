import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";

const socialProviders = {
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
  ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
    ? {
        facebook: {
          clientId: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        },
      }
    : {}),
};

export const auth = betterAuth({
  appName: "Academy LMS",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // legacy parity: 6-digit verification enforced post-signup (M2)
    /**
     * Migration bridge (spec §9.3): migrated users carry `legacy-sha1:<sha1>`
     * hashes from Academy v7.1 (unsalted SHA-1). On first successful login the
     * hash transparently upgrades to Better Auth's native scrypt.
     */
    password: {
      verify: async ({ password, hash }) => {
        if (hash.startsWith("legacy-sha1:")) {
          const expected = hash.slice("legacy-sha1:".length);
          const actual = createHash("sha1").update(password).digest("hex");
          return actual === expected;
        }
        const { verifyPassword } = await import("better-auth/crypto");
        return verifyPassword({ password, hash });
      },
    },
    sendResetPassword: async ({ user, url }) => {
      // TODO(M2): send via React Email + Resend/SMTP (spec §7.1)
      console.info(`[auth] password reset for ${user.email}: ${url}`);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // TODO(M2): send via React Email + Resend/SMTP (spec §7.1)
      console.info(`[auth] verification for ${user.email}: ${url}`);
    },
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: false },
      lastName: { type: "string", required: false },
      title: { type: "string", required: false }, // public headline
      biography: { type: "string", required: false },
      role: { type: "string", defaultValue: "student", input: false },
      isInstructor: { type: "boolean", defaultValue: false, input: false },
      status: { type: "string", defaultValue: "active", input: false },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 min session cache (spec §3 device-limit policies come later)
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },
  socialProviders,
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession["user"];
