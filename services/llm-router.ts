// Roteador de IA com chaves gratuitas. Tenta os provedores na ordem e pula
// quem bateu limite (429) por alguns minutos. Ollama local é o fallback sem limite.

export type LlmPurpose = "classify" | "write";

export interface LlmRequest {
  system: string;
  prompt: string;
  purpose: LlmPurpose;
  json?: boolean;
}

export interface LlmResponse {
  text: string;
  model: string;
  tokens?: number;
}

interface Provider {
  name: string;
  available: () => boolean;
  call: (req: LlmRequest) => Promise<LlmResponse>;
}

class RateLimited extends Error {}

const cooldownUntil = new Map<string, number>();
const COOLDOWN_MS = 10 * 60 * 1000;

async function openAiCompatible(
  url: string,
  key: string,
  model: string,
  req: LlmRequest,
  extraHeaders: Record<string, string> = {},
): Promise<LlmResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({
      model,
      temperature: req.purpose === "classify" ? 0 : 0.6,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) throw new RateLimited(`${model}: 429`);
  if (!res.ok) throw new Error(`${model}: HTTP ${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${model}: resposta vazia`);
  return { text, model, tokens: data.usage?.total_tokens };
}

const providers: Record<string, Provider> = {
  gemini: {
    name: "gemini",
    available: () => Boolean(process.env.GEMINI_API_KEY),
    call: async (req) => {
      const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: [{ role: "user", parts: [{ text: req.prompt }] }],
            generationConfig: {
              temperature: req.purpose === "classify" ? 0 : 0.6,
              ...(req.json ? { responseMimeType: "application/json" } : {}),
            },
          }),
        },
      );
      if (res.status === 429) throw new RateLimited("gemini: 429");
      if (!res.ok) throw new Error(`gemini: HTTP ${res.status}`);
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { totalTokenCount?: number };
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error("gemini: resposta vazia");
      return { text, model, tokens: data.usageMetadata?.totalTokenCount };
    },
  },
  groq: {
    name: "groq",
    available: () => Boolean(process.env.GROQ_API_KEY),
    call: (req) =>
      openAiCompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        process.env.GROQ_API_KEY ?? "",
        process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        req,
      ),
  },
  openrouter: {
    name: "openrouter",
    available: () => Boolean(process.env.OPENROUTER_API_KEY),
    call: (req) =>
      openAiCompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        process.env.OPENROUTER_API_KEY ?? "",
        process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
        req,
        { "X-Title": "nprospect" },
      ),
  },
  ollama: {
    name: "ollama",
    available: () => process.env.OLLAMA_DISABLED !== "true",
    call: async (req) => {
      const base = process.env.OLLAMA_URL ?? "http://localhost:11434";
      const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          ...(req.json ? { format: "json" } : {}),
          options: { temperature: req.purpose === "classify" ? 0 : 0.6 },
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.prompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`ollama: HTTP ${res.status}`);
      const data = (await res.json()) as { message?: { content?: string }; eval_count?: number };
      const text = data.message?.content?.trim();
      if (!text) throw new Error("ollama: resposta vazia");
      return { text, model: `ollama/${model}`, tokens: data.eval_count };
    },
  },
};

function order(purpose: LlmPurpose): string[] {
  const env = purpose === "classify" ? process.env.LLM_ORDER_CLASSIFY : process.env.LLM_ORDER_WRITE;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  return purpose === "classify"
    ? ["ollama", "groq", "gemini", "openrouter"]
    : ["gemini", "groq", "openrouter", "ollama"];
}

/** Chama o primeiro provedor disponível. Lança erro só se todos falharem. */
export async function complete(req: LlmRequest): Promise<LlmResponse> {
  const errors: string[] = [];
  for (const name of order(req.purpose)) {
    const p = providers[name];
    if (!p || !p.available()) continue;
    if ((cooldownUntil.get(name) ?? 0) > Date.now()) continue;
    try {
      return await p.call(req);
    } catch (err) {
      if (err instanceof RateLimited) cooldownUntil.set(name, Date.now() + COOLDOWN_MS);
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(`Nenhum provedor de IA respondeu: ${errors.join(" | ") || "nenhum configurado"}`);
}

/** Extrai o primeiro objeto JSON de um texto (modelos pequenos às vezes enfeitam). */
export function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("JSON não encontrado na resposta");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
