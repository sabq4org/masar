// طبقة الذكاء الاصطناعي — OpenAI عبر fetch مباشرة (بلا SDK).
// القاعدة: الذكاء يقترح والبشر يعتمدون؛ لا قرارات حساسة تلقائية.
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.AI_MODEL || "gpt-4o-mini";

export function aiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function aiJson<T>(system: string, user: string): Promise<T> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`فشل نداء الذكاء الاصطناعي (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as any;
  return JSON.parse(data.choices[0].message.content) as T;
}

export async function aiText(system: string, user: string): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`فشل نداء الذكاء الاصطناعي (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as any;
  return data.choices[0].message.content as string;
}
