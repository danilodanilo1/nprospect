// Prompts versionados. Toda mensagem gerada guarda a versão usada no log.
import { SIGNAL_LABELS, freshSignals, type ProspectSignal } from "@/lib/funnel";

export const PROMPT_VERSION = "2026-11-11.1";

export interface ProspectBrief {
  company: string;
  contactName?: string;
  city?: string;
  signals: ProspectSignal[];
}

const PRODUCT = `nRecruit (nrecruit.app): ATS para consultorias de recrutamento e recrutadores autônomos.
- Kanban por vaga, vários clientes ao mesmo tempo, portal do cliente, CV com a marca da consultoria.
- IA com a chave do próprio cliente, entrevista por IA, extensão do LinkedIn.
- Preço: Solo R$ 49,90/mês (1 recrutador); Equipe R$ 89,90/mês por recrutador. Trial grátis, sem fidelidade, cancela no painel.`;

const RULES = `Regras de escrita:
- Português do Brasil, tom de colega, frases curtas. Máximo 90 palavras no corpo.
- Uma única pergunta no fim, fácil de responder.
- Cite o sinal concreto (ex.: a vaga que a pessoa publicou) sem dizer como achamos o contato.
- Nunca invente números, clientes ou funcionalidades. Nunca cite concorrente pelo nome.
- Assine como "Danilo, nRecruit".
- Última linha sempre: "Se não fizer sentido, responda 'remover' que eu não escrevo mais."`;

export function briefText(p: ProspectBrief): string {
  const signals = freshSignals(p.signals)
    .map((s) => `- ${SIGNAL_LABELS[s.type]}${s.evidenceText ? `: ${s.evidenceText}` : ""}${s.evidenceUrl ? ` (${s.evidenceUrl})` : ""}`)
    .join("\n");
  return [
    `Empresa: ${p.company}`,
    p.contactName ? `Pessoa: ${p.contactName}` : null,
    p.city ? `Cidade: ${p.city}` : null,
    `Sinais recentes:\n${signals || "- nenhum"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function firstTouchPrompt(p: ProspectBrief) {
  return {
    system: `Você escreve o primeiro e-mail frio de venda do produto abaixo.\n${PRODUCT}\n\n${RULES}\nResponda em JSON: {"subject": "assunto curto, minúsculo, até 6 palavras", "body": "texto"}.`,
    prompt: briefText(p),
  };
}

export function followUpPrompt(p: ProspectBrief, n: number, previous: string) {
  return {
    system: `Você escreve o follow-up ${n} de um e-mail frio sem resposta, na mesma conversa.\n${PRODUCT}\n\n${RULES}\nFollow-up tem no máximo 50 palavras, traz um ângulo novo e não repete o anterior. Responda em JSON: {"body": "texto"}.`,
    prompt: `${briefText(p)}\n\nE-mail anterior:\n${previous}`,
  };
}

export const REPLY_CLASSES = ["INTERESSE", "DUVIDA", "OBJECAO", "NAO_AGORA", "REMOVER", "AMBIGUA"] as const;

export function classifyPrompt(reply: string) {
  return {
    system: `Classifique a resposta de um lead a um e-mail de venda de software.
Classes: INTERESSE (quer testar, ver, saber preço ou marcar conversa), DUVIDA (pergunta algo sem decidir), OBJECAO (já usa outro, caro, sem tempo), NAO_AGORA (não agora, mais pra frente), REMOVER (pede para parar, descadastrar, reclama do contato), AMBIGUA (irritada, irônica ou não dá para saber).
Responda em JSON: {"class": "...", "confidence": 0..1, "summary": "uma frase"}.`,
    prompt: reply.slice(0, 4000),
  };
}

export function closerPrompt(p: ProspectBrief, history: string, signupUrl: string) {
  return {
    system: `Você responde um lead que respondeu ao nosso e-mail. Objetivo: levar ao trial grátis (${signupUrl}) ou a uma conversa de 20 minutos.\n${PRODUCT}\n\nRegras: responda exatamente o que a pessoa perguntou, em até 80 palavras, sem pressão. Nunca ofereça desconto nem condição fora da tabela. Se pedir algo que você não sabe, diga que o Danilo responde pessoalmente. Assine "Danilo, nRecruit". Responda em JSON: {"body": "texto"}.`,
    prompt: `${briefText(p)}\n\nConversa até agora (mais antiga primeiro):\n${history}`,
  };
}

/** Texto usado quando nenhuma IA responde: o sistema nunca fica parado. */
export function fallbackFirstTouch(p: ProspectBrief): { subject: string; body: string } {
  const name = p.contactName?.split(" ")[0];
  const fresh = freshSignals(p.signals);
  const semAts = fresh.find((s) => s.type === "SEM_ATS");
  const opening = semAts
    ? `Vi a vaga que vocês publicaram${semAts.evidenceText ? ` ("${semAts.evidenceText}")` : ""} pedindo currículo por e-mail.`
    : `Vi que a ${p.company} está com várias vagas abertas.`;
  return {
    subject: semAts ? "currículos por e-mail" : `vagas da ${p.company.toLowerCase()}`,
    body: `${name ? `Oi, ${name}` : "Oi"}, tudo bem?\n\n${opening} Organizar CV de várias vagas e clientes em caixa de e-mail e planilha vira bagunça rápido.\n\nO nRecruit coloca isso num kanban por vaga e por cliente, a partir de R$ 49,90/mês, com teste grátis.\n\nFaz sentido eu te mostrar em 10 minutos?\n\nDanilo, nRecruit\n\nSe não fizer sentido, responda 'remover' que eu não escrevo mais.`,
  };
}
