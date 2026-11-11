// Base comum dos coletores de vagas (InfoJobs, LinkedIn público): requisição educada,
// filtro de consultoria de RH, detecção de SEM_ATS e agregação de VOLUME_ALTO.
import type { ProspectInput } from "@/lib/csv";
import type { ProspectSignal } from "@/lib/funnel";
import { CollectorBlocked, type CollectorContext } from "./types";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36";

export interface Vaga {
  id: string;
  title: string;
  url: string;
  company: string;
  city?: string;
  postedAt?: Date;
  /** texto completo da vaga (só preenchido quando o detalhe foi lido) */
  description?: string;
}

/** Busca uma página respeitando 5 a 10 s entre requisições ao mesmo site. */
export function politeFetcher(ctx: CollectorContext, site: string) {
  let first = true;
  return async (url: string): Promise<string> => {
    if (!first) await ctx.sleep(5000 + Math.random() * 5000);
    first = false;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } });
    // LinkedIn responde 999 quando limita robôs
    if (res.status === 429 || res.status === 999 || res.status === 403) throw new CollectorBlocked(`${site}: HTTP ${res.status}`);
    if (!res.ok) throw new Error(`${site}: HTTP ${res.status} em ${url}`);
    const html = await res.text();
    if (/captcha|security check|cf-challenge|authwall/i.test(html.slice(0, 5000))) throw new CollectorBlocked(`${site}: captcha ou bloqueio`);
    return html;
  };
}

const RECRUITER_NAME =
  /\b(rh|r\.h\.|recursos humanos|talent|recrut|recruit|sele[cç][aã]o|consultoria|gest[aã]o de pessoas|staffing|head ?hunt|hunting|people|carreiras?|terceiriza|outsourcing|m[aã]o de obra|tempor[aá]rios?)/i;
const RECRUITER_TEXT =
  /(nossa consultoria|consultoria de (rh|recrutamento|recursos humanos)|para (nosso|um) cliente|empresa cliente|estamos recrutando para|recrutando para (uma|empresa))/i;

/** Nome ou texto da vaga indica consultoria/agência de recrutamento. */
export function isRecruiter(company: string, text = ""): boolean {
  return RECRUITER_NAME.test(company) || RECRUITER_TEXT.test(text);
}

export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>|<\/(p|li|div)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .trim();
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const IGNORED_EMAIL = /(noreply|no-reply|linkedin\.com|infojobs|example\.|sentry|wixpress)/i;
const PHONE = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-.\s]?\d{4}/g;

export interface Contato {
  email?: string;
  phone?: string;
  channel?: "e-mail" | "WhatsApp" | "Google Forms";
}

/** Contato que a própria vaga publica e o canal pelo qual pede o currículo (SEM_ATS). */
export function detectNoAts(text: string): Contato {
  const email = (text.match(EMAIL) ?? []).find((e) => !IGNORED_EMAIL.test(e))?.toLowerCase();
  const waLink = text.match(/wa\.me\/(\d{10,13})/i)?.[1];
  const whatsapp = /whats\s?app|wpp|zap\b/i.test(text);
  const phone = waLink ?? (whatsapp ? text.match(PHONE)?.[0]?.trim() : undefined);
  const forms = /forms\.gle\/|docs\.google\.com\/forms/i.test(text);
  const asksCv = /curr[ií]culo|\bcv\b/i.test(text);
  const channel = forms ? "Google Forms" : asksCv && email ? "e-mail" : asksCv && phone ? "WhatsApp" : undefined;
  return { email, phone, channel };
}

/** Uma linha por consultoria: SEM_ATS por vaga com canal manual, VOLUME_ALTO com 5+ vagas em 7 dias. */
export function vagasToProspects(vagas: Vaga[], now: Date): ProspectInput[] {
  const weekAgo = now.getTime() - 7 * 864e5;
  const byCompany = new Map<string, Vaga[]>();
  for (const v of vagas) {
    if (!isRecruiter(v.company, v.description)) continue;
    const key = v.company.trim().toLowerCase();
    byCompany.set(key, [...(byCompany.get(key) ?? []), v]);
  }
  const out: ProspectInput[] = [];
  for (const list of byCompany.values()) {
    const unique = [...new Map(list.map((v) => [v.id, v])).values()];
    const signals: ProspectSignal[] = [];
    let contato: Contato = {};
    for (const v of unique) {
      if (!v.description) continue;
      const c = detectNoAts(v.description);
      if (!c.channel) continue;
      contato = { email: contato.email ?? c.email, phone: contato.phone ?? c.phone };
      signals.push({ type: "SEM_ATS", seenAt: v.postedAt ?? now, evidenceText: `${v.title} (currículo por ${c.channel})`, evidenceUrl: v.url });
    }
    // shortcut: conta só as vagas que as buscas do coletor viram, não o total da empresa; abrir a página da empresa se subcontar
    const recent = unique.filter((v) => (v.postedAt?.getTime() ?? now.getTime()) >= weekAgo);
    if (recent.length >= 5) {
      signals.push({
        type: "VOLUME_ALTO",
        seenAt: now,
        evidenceText: `${recent.length} vagas em 7 dias: ${recent.slice(0, 3).map((v) => v.title).join("; ")}`,
        evidenceUrl: recent[0].url,
      });
    }
    if (signals.length === 0) continue;
    out.push({ company: unique[0].company.trim(), email: contato.email, phone: contato.phone, city: unique.find((v) => v.city)?.city, signals });
  }
  return out;
}
