import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { LEGACY_FILE, locales, type Locale } from "@/i18n/locales";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const locale = new URL(request.url).searchParams.get("locale") ?? "en";
  if (!locales.includes(locale as Locale)) {
    return NextResponse.json({ error: "unknown locale" }, { status: 400 });
  }
  const file = path.join(process.cwd(), "..", "Academy-LMS", "languages", `${LEGACY_FILE[locale as Locale]}.json`);
  const body = readFileSync(file, "utf8");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename=${locale}.json`,
    },
  });
}
