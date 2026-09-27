import { createHash } from "node:crypto";

export async function resolveProviderJoinUrl(input: {
  provider: string;
  title: string;
  courseId: string;
  startsAt: string;
  joinUrl?: string | null;
}): Promise<{ joinUrl: string | null; moderatorUrl?: string }> {
  if (input.joinUrl) return { joinUrl: input.joinUrl };
  if (input.provider === "jitsi") {
    return {
      joinUrl: `https://meet.jit.si/academy-${input.courseId.slice(0, 8)}-${Date.now().toString(36)}`,
    };
  }
  if (input.provider === "zoom") {
    const account = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;
    if (!account || !clientId || !clientSecret) return { joinUrl: null };
    const tokenRes = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${account}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
      },
    );
    if (!tokenRes.ok) return { joinUrl: null };
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return { joinUrl: null };
    const meeting = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: input.title,
        type: 2,
        start_time: new Date(input.startsAt).toISOString(),
      }),
    });
    if (!meeting.ok) return { joinUrl: null };
    const created = (await meeting.json()) as { join_url?: string; start_url?: string };
    return { joinUrl: created.join_url ?? null, moderatorUrl: created.start_url };
  }
  if (input.provider === "bbb") {
    const server = process.env.BBB_SERVER_URL;
    const secret = process.env.BBB_SECRET;
    if (!server || !secret) return { joinUrl: null };
    const meetingId = `academy-${input.courseId.slice(0, 8)}`;
    const query = `name=${encodeURIComponent(input.title)}&meetingID=${meetingId}&attendeePW=ap&moderatorPW=mp`;
    const checksum = createHash("sha1").update(`create${query}${secret}`).digest("hex");
    await fetch(`${server.replace(/\/$/, "")}/api/create?${query}&checksum=${checksum}`);
    const joinQuery = `fullName=Student&meetingID=${meetingId}&password=ap`;
    const joinChecksum = createHash("sha1").update(`join${joinQuery}${secret}`).digest("hex");
    return { joinUrl: `${server.replace(/\/$/, "")}/api/join?${joinQuery}&checksum=${joinChecksum}` };
  }
  return { joinUrl: null };
}
