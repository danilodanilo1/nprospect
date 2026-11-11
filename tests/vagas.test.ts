import { test } from "node:test";
import assert from "node:assert/strict";
import { detectNoAts, isRecruiter, vagasToProspects, type Vaga } from "@/collectors/vagas";
import { parseInfojobsDetail, parseInfojobsSearch } from "@/collectors/infojobs";
import { parseLinkedinSearch } from "@/collectors/linkedin-vagas";

const now = new Date("2026-11-11T13:00:00Z");

test("vagas: detecta canal manual de currículo", () => {
  assert.deepEqual(detectNoAts("Envie seu currículo para Vagas@RHtop.com.br"), { email: "vagas@rhtop.com.br", phone: undefined, channel: "e-mail" });
  assert.equal(detectNoAts("Currículo pelo WhatsApp (11) 94017-8659").phone, "(11) 94017-8659");
  assert.equal(detectNoAts("Inscreva-se: https://forms.gle/abc").channel, "Google Forms");
  assert.equal(detectNoAts("Candidate-se pelo botão. Dúvidas: contato@empresa.com").channel, undefined);
});

test("vagas: reconhece consultoria pelo nome ou pelo texto", () => {
  assert.ok(isRecruiter("RHF Talentos Piçarras"));
  assert.ok(isRecruiter("Acme", "Estamos recrutando para nosso cliente do setor químico"));
  assert.ok(!isRecruiter("Cacau Show", "Venha trabalhar conosco"));
});

test("vagas: SEM_ATS por vaga e VOLUME_ALTO com 5+ vagas na semana", () => {
  const base = { company: "Alpha RH", postedAt: now, url: "https://x/1" };
  const vagas: Vaga[] = [1, 2, 3, 4, 5].map((i) => ({ ...base, id: String(i), title: `Vaga ${i}` }));
  vagas[0].description = "Currículo para vagas@alpharh.com";
  vagas.push({ id: "9", title: "Caixa", url: "u", company: "Mercado Bom", description: "Currículo para a@b.com" });
  const [lead, ...rest] = vagasToProspects(vagas, now);
  assert.equal(rest.length, 0);
  assert.equal(lead.email, "vagas@alpharh.com");
  assert.deepEqual(lead.signals.map((s) => s.type), ["SEM_ATS", "VOLUME_ALTO"]);
});

test("infojobs: lê cartão da busca e JSON-LD do detalhe", () => {
  const card = `<div id="vacancy12176194" data-href="/vaga-de-x__12176194.aspx"><div hidden class="js_date" data-value="2026/10/31 04:40:00">
  <h2 class="h3 js_vacancyTitle">\n Consultor Comercial\n</h2><a class="text-body" href="https://www.infojobs.com.br/empresa-rhf__947592.aspx">\nRHF Talentos Botucatu &#x2013;\n<span>
  <div class="mb-8">\nBotucatu - SP<span hidden>`;
  const [v] = parseInfojobsSearch(card);
  assert.equal(v.company, "RHF Talentos Botucatu");
  assert.equal(v.city, "Botucatu - SP");
  assert.equal(v.title, "Consultor Comercial");
  const detail = `<script type="application/ld+json">{"@type":"JobPosting","description":"Envie currículo<br>para a@b.com"}</script>`;
  assert.equal(parseInfojobsDetail(detail), "Envie currículo\npara a@b.com");
});

test("linkedin: lê cartão da busca pública", () => {
  const card = `<li><div data-entity-urn="urn:li:jobPosting:42"><h3 class="base-search-card__title">\n Recrutador\n</h3>
  <h4 class="base-search-card__subtitle"><a href="x">\n Beta Talentos\n</a></h4><span class="job-search-card__location">\n Itapevi, São Paulo, Brazil\n</span>
  <time class="job-search-card__listdate" datetime="2026-11-06">`;
  const [v] = parseLinkedinSearch(card);
  assert.equal(v.url, "https://www.linkedin.com/jobs/view/42");
  assert.equal(v.company, "Beta Talentos");
  assert.equal(v.city, "Itapevi, São Paulo");
});
