import type {
  OpportunityCategory,
  OpportunityTemperature,
} from "@/types/lead";

export const STRONG_CONSTRUCTION_TERMS = [
  "execução de obra",
  "execucao de obra",
  "obra de construção",
  "obra de construcao",
  "obras",
  "obra",
  "construção",
  "construcao",
  "engenharia",
  "engenharia civil",
  "reforma",
  "ampliação",
  "ampliacao",
  "manutenção predial",
  "manutencao predial",
  "pavimentação",
  "pavimentacao",
  "drenagem",
  "terraplenagem",
  "instalações elétricas",
  "instalacoes eletricas",
  "instalação elétrica",
  "instalacao eletrica",
  "elétrica",
  "eletrica",
  "instalações hidráulicas",
  "instalacoes hidraulicas",
  "instalação hidráulica",
  "instalacao hidraulica",
  "hidráulica",
  "hidraulica",
  "alvenaria",
  "cobertura",
  "estrutura metálica",
  "estrutura metalica",
  "impermeabilização",
  "impermeabilizacao",
];

export const USEFUL_MATERIAL_TERMS = [
  "material de construção",
  "material de construcao",
  "cimento",
  "areia",
  "brita",
  "concreto",
  "bloco",
  "tijolo",
  "argamassa",
  "telha",
  "hidráulico",
  "hidraulico",
  "elétrico",
  "eletrico",
  "pintura",
  "acabamento",
  "ferragem",
  "vergalhão",
  "vergalhao",
  "madeira para construção",
  "madeira para construcao",
];

export const NEGATIVE_TERMS = [
  "material de escritório",
  "material de escritorio",
  "expediente",
  "limpeza",
  "higiene",
  "copa",
  "cozinha",
  "alimentício",
  "alimenticio",
  "merenda",
  "medicamento",
  "hospitalar",
  "odontológico",
  "odontologico",
  "informática",
  "informatica",
  "software",
  "toner",
  "cartucho",
  "combustível",
  "combustivel",
  "uniforme",
  "mobiliário",
  "mobiliario",
  "material escolar",
  "gêneros alimentícios",
  "generos alimenticios",
];

const DEMAND_BY_TERM: Array<{ term: string; demand: string[] }> = [
  { term: "reforma", demand: ["cimento", "argamassa", "pintura", "acabamento"] },
  { term: "constru", demand: ["cimento", "areia", "brita", "blocos/tijolos"] },
  { term: "alvenaria", demand: ["blocos/tijolos", "cimento", "areia"] },
  { term: "hidraul", demand: ["tubos e conexões", "registros", "louças"] },
  { term: "eletric", demand: ["fios e cabos", "conduítes", "disjuntores"] },
  { term: "pintura", demand: ["tintas", "seladores", "massas"] },
  { term: "cobertura", demand: ["telhas", "madeiramento", "calhas"] },
  { term: "paviment", demand: ["cimento", "brita", "ferragens"] },
];

export interface OpportunityTextClassification {
  matchedPositiveTerms: string[];
  matchedNegativeTerms: string[];
  category: OpportunityCategory;
  confidence: number;
  estimatedDemand: string[];
}

export interface OpportunityScoreResult {
  score: number;
  temperature: OpportunityTemperature;
  category: OpportunityCategory;
  confidence: number;
  reasons: string[];
  penalties: string[];
  matchedPositiveTerms: string[];
  matchedNegativeTerms: string[];
  estimatedDemand: string[];
  rejectionReason?: string;
}

export function normalizeOpportunityText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function matchTerms(text: string, terms: string[]): string[] {
  const normalizedText = normalizeOpportunityText(text);
  return terms.filter((term) =>
    normalizedText.includes(normalizeOpportunityText(term)),
  );
}

export function classifyOpportunityText(
  text: string,
): OpportunityTextClassification {
  const strongMatches = matchTerms(text, STRONG_CONSTRUCTION_TERMS);
  const materialMatches = matchTerms(text, USEFUL_MATERIAL_TERMS);
  const negativeMatches = matchTerms(text, NEGATIVE_TERMS);
  const matchedPositiveTerms = [...new Set([...strongMatches, ...materialMatches])];

  let category: OpportunityCategory = "UNKNOWN";
  if (negativeMatches.length > 0 && strongMatches.length === 0) {
    category = "NOISE";
  } else if (strongMatches.length > 0) {
    category = "CONSTRUCTION";
  } else if (materialMatches.length > 0) {
    category = "MATERIALS";
  }

  const estimatedDemand = DEMAND_BY_TERM.flatMap(({ term, demand }) =>
    normalizeOpportunityText(text).includes(term) ? demand : [],
  );

  const confidence = Math.min(
    100,
    strongMatches.length * 30 +
      materialMatches.length * 15 -
      negativeMatches.length * 35,
  );

  return {
    matchedPositiveTerms,
    matchedNegativeTerms: negativeMatches,
    category,
    confidence: Math.max(0, confidence),
    estimatedDemand: [...new Set(estimatedDemand)],
  };
}

export function temperatureFromScore(
  score: number,
  discarded: boolean,
): OpportunityTemperature {
  if (discarded) return "DISCARDED";
  if (score >= 75) return "HOT";
  if (score >= 45) return "WARM";
  if (score >= 20) return "COLD";
  return "DISCARDED";
}
