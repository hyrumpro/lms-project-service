import { createHash } from "node:crypto";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { getSystemSettings } from "@/lib/settings";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/server/services/email";

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
  ...(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET
    ? {
        linkedin: {
          clientId: process.env.LINKEDIN_CLIENT_ID,
          clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
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
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl: url,
        userName: user.name,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        verifyUrl: url,
        userName: user.name,
      });
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
      maxAge: 5 * 60,
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (sessionData) => {
          const [row] = await db
            .select({ status: user.status })
            .from(user)
            .where(eq(user.id, sessionData.userId))
            .limit(1);
          if (row?.status === "disabled") {
            const system = await getSystemSettings().catch(() => null);
            throw APIError.from("FORBIDDEN", {
              code: "ACCOUNT_DISABLED",
              message:
                system?.accountDisableMessage ??
                "Your account has been disabled. Please contact the administrator.",
            });
          }
          const system = await getSystemSettings().catch(() => null);
          const cap = system?.allowedDeviceLogins ?? 0;
          if (cap > 0) {
            const existing = await db
              .select({ id: session.id })
              .from(session)
              .where(eq(session.userId, sessionData.userId))
              .orderBy(asc(session.createdAt));
            const overflow = existing.length - (cap - 1);
            if (overflow > 0) {
              await db.delete(session).where(
                inArray(
                  session.id,
                  existing.slice(0, overflow).map((row) => row.id),
                ),
              );
            }
          }
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },
  socialProviders,
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3100"],
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession["user"];
