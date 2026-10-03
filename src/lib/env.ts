/**
 * Environment helpers.
 *
 * The "Sandbox Bank" mock gateway and the demo subscription flow exist so the
 * product can be demonstrated and end-to-end tested without real payment
 * credentials. They grant access with no real charge, so they MUST be hidden
 * in production. `next start` / Vercel run with NODE_ENV=production; a staging
 * box that still needs the demo can opt back in with ALLOW_MOCK_GATEWAY=1.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True when the mock/demo payment path is allowed to be used. */
export function allowMockGateway(): boolean {
  if (process.env.ALLOW_MOCK_GATEWAY === "1") return true;
  return process.env.NODE_ENV !== "production";
}
