// LinkedIn: SÓ a busca pública de vagas (jobs-guest), sem login, sem cookie.
// Authwall, 429 ou 999 = CollectorBlocked.
import type { Collector } from "./types";
import { decodeEntities, htmlToText, isRecruiter, politeFetcher, vagasToProspects, type Vaga } from "./vagas";

const BASE = "https://www.linkedin.com/jobs-guest/jobs/api";
const BRASIL = "106057199";
const QUERIES = ["currículo whatsapp", "enviar currículo e-mail", "currículo google forms", "consultoria de rh", "recrutamento e seleção"];
const PAGES = 1; // 10 vagas por página; 2+ páginas levou a 429 no teste de 11/11
const MAX_DETAILS = 15;

export function parseLinkedinSearch(html: string): Vaga[] {
  return html
    .split("<li>")
    .slice(1)
    .map((card) => {
      const id = card.match(/urn:li:jobPosting:(\d+)/)?.[1];
      const title = card.match(/base-search-card__title">\s*([^<]+)/)?.[1];
      const company = card.match(/base-search-card__subtitle">[\s\S]*?>\s*([^<]+?)\s*</)?.[1];
      const city = card.match(/job-search-card__location">\s*([^<]+)/)?.[1];
      const date = card.match(/<time[^>]*datetime="([^"]+)"/)?.[1];
      if (!id || !title || !company) return null;
      return {
        id,
        url: `https://www.linkedin.com/jobs/view/${id}`,
        title: decodeEntities(title).trim(),
        company: decodeEntities(company).trim(),
        city: city ? decodeEntities(city).trim().replace(/, Brazil$/, "") : undefined,
        postedAt: date ? new Date(`${date}T12:00:00-03:00`) : undefined,
      } satisfies Vaga;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
}

export function parseLinkedinDetail(html: string): string | undefined {
  const m = html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/);
  return m ? htmlToText(m[1]) : undefined;
}

export const linkedinVagas: Collector = {
  name: "linkedin-vagas",
  everyHours: 24,
  requiresLogin: false,
  async run(ctx) {
    const get = politeFetcher(ctx, "linkedin");
    const seen = new Map<string, Vaga>();
    for (const q of QUERIES) {
      for (let p = 0; p < PAGES; p++) {
        const url = `${BASE}/seeMoreJobPostings/search?keywords=${encodeURIComponent(q)}&geoId=${BRASIL}&f_TPR=r604800&start=${p * 10}`;
        const vagas = parseLinkedinSearch(await get(url));
        for (const v of vagas) seen.set(v.id, v);
        ctx.log(`linkedin: "${q}" p${p + 1} ${vagas.length} vagas`);
        if (vagas.length < 10) break;
      }
    }
    const toRead = [...seen.values()].filter((v) => isRecruiter(v.company)).slice(0, MAX_DETAILS);
    for (const v of toRead) v.description = parseLinkedinDetail(await get(`${BASE}/jobPosting/${v.id}`));
    ctx.log(`linkedin: ${seen.size} vagas, ${toRead.length} detalhes de consultorias`);
    return vagasToProspects([...seen.values()], ctx.now);
  },
};
