// InfoJobs Brasil: busca pública (HTML) + JSON-LD JobPosting do detalhe. Sem login.
import type { Collector } from "./types";
import { decodeEntities, htmlToText, isRecruiter, politeFetcher, vagasToProspects, type Vaga } from "./vagas";

const BASE = "https://www.infojobs.com.br";
const QUERIES = [
  "enviar curriculo email",
  "curriculo whatsapp",
  "curriculo google forms",
  "consultoria de rh",
  "recrutamento e selecao",
  "rh talentos",
];
const MAX_DETAILS = 40;

/** Cartões da página de busca. */
export function parseInfojobsSearch(html: string): Vaga[] {
  return html
    .split(/<div id="vacancy(?=\d)/)
    .slice(1)
    .map((card) => {
      const id = card.match(/^(\d+)/)?.[1] ?? "";
      const href = card.match(/data-href="([^"]+)"/)?.[1];
      const title = card.match(/js_vacancyTitle">\s*([^<]+)/)?.[1];
      const company = card.match(/href="[^"]*\/empresa-[^"]+">\s*([^<]+)/)?.[1];
      const city = card.match(/<div class="mb-8">\s*([^<]+?)\s*<span/)?.[1];
      const date = card.match(/js_date" data-value="([^"]+)"/)?.[1];
      if (!id || !href || !title || !company) return null;
      return {
        id,
        url: BASE + href,
        title: decodeEntities(title).trim(),
        company: decodeEntities(company).replace(/\s*[–-]\s*$/, "").trim(),
        city: city ? decodeEntities(city).trim() : undefined,
        postedAt: date ? new Date(date.replace(/\//g, "-").replace(" ", "T") + "-03:00") : undefined,
      } satisfies Vaga;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
}

/** Texto da vaga a partir do JSON-LD do detalhe. */
export function parseInfojobsDetail(html: string): string | undefined {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      if (data["@type"] === "JobPosting") return htmlToText(String(data.description ?? ""));
    } catch {
      // bloco JSON-LD inválido: ignora
    }
  }
  return undefined;
}

export const infojobs: Collector = {
  name: "infojobs",
  everyHours: 24,
  requiresLogin: false,
  async run(ctx) {
    const get = politeFetcher(ctx, "infojobs");
    const seen = new Map<string, Vaga>();
    for (const q of QUERIES) {
      const vagas = parseInfojobsSearch(await get(`${BASE}/empregos.aspx?palabra=${encodeURIComponent(q)}`));
      for (const v of vagas) seen.set(v.id, v);
      ctx.log(`infojobs: "${q}" ${vagas.length} vagas`);
    }
    const toRead = [...seen.values()].filter((v) => isRecruiter(v.company)).slice(0, MAX_DETAILS);
    for (const v of toRead) v.description = parseInfojobsDetail(await get(v.url));
    ctx.log(`infojobs: ${seen.size} vagas, ${toRead.length} detalhes de consultorias`);
    return vagasToProspects([...seen.values()], ctx.now);
  },
};
