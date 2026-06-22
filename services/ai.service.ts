import Lead, { type ILead } from "@/models/Lead";
import { logActivity } from "@/services/activity-log.service";

type AIProvider = "openai" | "gemini";

interface EnrichmentResult {
  summary: string;
  pitch: string;
}

function getProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER;
  if (provider === "gemini") return "gemini";
  return "openai";
}

function buildPrompt(lead: ILead): string {
  const parts = [
    `Empresa: ${lead.name}`,
    lead.cnpj ? `CNPJ: ${lead.cnpj}` : null,
    lead.contacts.phone ? `Telefone: ${lead.contacts.phone}` : null,
    lead.contacts.email ? `Email: ${lead.contacts.email}` : null,
    lead.contacts.address ? `Endereço: ${lead.contacts.address}` : null,
    lead.metadata.pncp?.object
      ? `Licitação PNCP: ${lead.metadata.pncp.object}`
      : null,
    lead.metadata.pncp?.value
      ? `Valor licitação: R$ ${lead.metadata.pncp.value}`
      : null,
    lead.metadata.google?.rating
      ? `Avaliação Google: ${lead.metadata.google.rating}`
      : null,
    `Fontes: ${lead.sources.join(", ")}`,
    `Score atual: ${lead.score}`,
  ].filter(Boolean);

  return parts.join("\n");
}

async function callOpenAI(prompt: string): Promise<EnrichmentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você é especialista em prospecção B2B para loja de materiais de construção no Brasil. Responda em JSON com campos summary (qualificação em 2-3 frases) e pitch (mensagem comercial curta para WhatsApp).",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia da OpenAI");

  const parsed = JSON.parse(content) as EnrichmentResult;
  return parsed;
}

async function callGemini(prompt: string): Promise<EnrichmentResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Você é especialista em prospecção B2B para materiais de construção. Retorne JSON com summary e pitch.\n\n${prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Resposta vazia do Gemini");

  return JSON.parse(text) as EnrichmentResult;
}

function fallbackEnrichment(lead: ILead): EnrichmentResult {
  const hasPncp = Boolean(lead.metadata.pncp?.bidId);
  const hasGoogle = lead.sources.includes("GOOGLE_PLACES");

  return {
    summary: `${lead.name} é um lead ${lead.score >= 50 ? "prioritário" : "em qualificação"} com score ${lead.score}. ${
      hasPncp
        ? "Possui licitação PNCP relacionada a obras."
        : "Sem licitação PNCP confirmada ainda."
    } ${hasGoogle ? "Presença validada no Google Maps." : ""}`.trim(),
    pitch: `Olá! Somos fornecedores de materiais de construção e identificamos oportunidades para apoiar as obras da ${lead.name}. Podemos enviar cotação com condições especiais para construtoras da região. Posso agendar uma conversa?`,
  };
}

export async function enrichLeadWithAI(leadId: string): Promise<ILead | null> {
  const lead = await Lead.findById(leadId);
  if (!lead) return null;

  const prompt = buildPrompt(lead);
  let result: EnrichmentResult;

  try {
    result =
      getProvider() === "gemini"
        ? await callGemini(prompt)
        : await callOpenAI(prompt);
  } catch (error) {
    await logActivity("warn", "ai-service", "Fallback de IA utilizado", {
      leadId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    result = fallbackEnrichment(lead);
  }

  lead.metadata = {
    ...lead.metadata,
    aiSummary: result.summary,
    aiPitch: result.pitch,
    aiQualifiedAt: new Date().toISOString(),
  };
  lead.lastActivityAt = new Date();
  await lead.save();

  return lead;
}
