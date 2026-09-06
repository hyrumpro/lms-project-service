/**
 * OpenAI helper (spec §7.16) — graceful when no key is configured.
 */
export async function chatComplete(
  messages: { role: "system" | "user"; content: string }[],
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "OPENAI_API_KEY is not configured. Add it to .env to enable the studio assistant (spec §7.16).",
    };
  }
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages,
        temperature: 0.7,
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `OpenAI error ${response.status}` };
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    return text ? { ok: true, text } : { ok: false, error: "Empty response" };
  } catch {
    return { ok: false, error: "Could not reach OpenAI" };
  }
}
