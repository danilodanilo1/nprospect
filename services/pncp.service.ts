import { logActivity } from "@/services/activity-log.service";
import { parseRegion, matchesRegionLocation } from "@/lib/region";
import {
  classifyOpportunityText,
  type OpportunityTextClassification,
} from "@/services/opportunity-rules.service";
import type { IngestionLeadPayload } from "@/types/ingestion";

export interface PncpSearchParams {
  keywords?: string[];
  object?: string;
  region?: string;
  page?: number;
  pageSize?: number;
  /** Formato YYYYMMDD */
  dateFrom?: string;
  /** Formato YYYYMMDD */
  dateTo?: string;
  minValue?: number;
}

interface PncpContractItem {
  orgaoEntidade?: { razaoSocial?: string; cnpj?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string };
  nomeRazaoSocialFornecedor?: string;
  niFornecedor?: string;
  valorGlobal?: number;
  valorInicial?: number;
  objetoContrato?: string;
  dataAssinatura?: string;
  dataPublicacaoPncp?: string;
  numeroControlePncpCompra?: string;
  numeroContratoEmpenho?: string;
  tipoContrato?: { nome?: string };
}

interface PncpPublicacaoItem {
  numeroControlePNCP?: string;
  objetoCompra?: string;
  valorTotalEstimado?: number;
  valorTotalHomologado?: number;
  dataPublicacaoPncp?: string;
  modalidadeNome?: string;
  orgaoEntidade?: { razaoSocial?: string; cnpj?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string; nomeUnidade?: string };
}

interface PncpSearchResponse<T> {
  data?: T[];
  totalRegistros?: number;
  totalPaginas?: number;
  numeroPagina?: number;
  paginasRestantes?: number;
}

interface PncpPageResult {
  leads: IngestionLeadPayload[];
  totalPaginas: number;
  discarded: number;
}

const DEFAULT_KEYWORDS = ["obra", "reforma", "construção", "engenharia"];

/** Modalidades mais comuns: Pregão eletrônico/presencial e dispensa. */
const PNCP_MODALIDADES = [6, 7, 8];

const MAX_SCAN_PAGES = 15;
const MAX_SCAN_PAGES_WITH_REGION = 8;
const PARALLEL_PAGE_BATCH = 1;
const TARGET_LEADS = 50;
const DEFAULT_MIN_VALUE = 10_000;
const FETCH_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;
const MAX_PAGES_PER_MODALITY = 5;

function getBaseUrl(): string {
  return (
    process.env.PNCP_BASE_URL ?? "https://pncp.gov.br/api/consulta"
  ).replace(/\/$/, "");
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function resolveDateRange(params: PncpSearchParams): {
  dataInicial: string;
  dataFinal: string;
} {
  if (params.dateFrom && params.dateTo) {
    return { dataInicial: params.dateFrom, dataFinal: params.dateTo };
  }

  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 90);

  return {
    dataInicial: params.dateFrom ?? formatDate(from),
    dataFinal: params.dateTo ?? formatDate(today),
  };
}

function collectSearchTerms(
  keywords: string[],
  objectFilter?: string,
): string[] {
  const terms = new Set<string>();

  if (objectFilter?.trim()) {
    for (const term of objectFilter.split(/[\s,;]+/)) {
      const normalized = normalizeText(term.trim());
      if (normalized.length >= 3) terms.add(normalized);
    }
  }

  for (const keyword of keywords) {
    const normalized = normalizeText(keyword.trim());
    if (normalized.length >= 3) terms.add(normalized);
  }

  if (terms.size === 0) {
    for (const keyword of DEFAULT_KEYWORDS) {
      terms.add(normalizeText(keyword));
    }
  }

  return [...terms];
}

function matchesKeywords(
  text: string,
  keywords: string[],
  objectFilter?: string,
): boolean {
  const normalizedText = normalizeText(text);
  const terms = collectSearchTerms(keywords, objectFilter);
  return terms.some((term) => normalizedText.includes(term));
}

function shouldAcceptPncpItem(
  objectText: string,
  value: number,
  params: PncpSearchParams,
  keywordMatched: boolean,
): {
  accepted: boolean;
  classification: OpportunityTextClassification;
  rejectionReason?: string;
} {
  const classification = classifyOpportunityText(objectText);
  const minValue = params.minValue ?? DEFAULT_MIN_VALUE;

  if (classification.category === "NOISE") {
    return {
      accepted: false,
      classification,
      rejectionReason: "Objeto contém termos negativos fora de obras",
    };
  }

  if (value > 0 && value < minValue) {
    return {
      accepted: false,
      classification,
      rejectionReason: `Valor abaixo do mínimo de R$ ${minValue}`,
    };
  }

  const hasConstructionSignal =
    classification.category === "CONSTRUCTION" ||
    classification.category === "MATERIALS" ||
    (keywordMatched && classification.category === "UNKNOWN");

  if (!hasConstructionSignal) {
    return {
      accepted: false,
      classification,
      rejectionReason: "Objeto sem intenção clara de obra ou material de construção",
    };
  }

  return { accepted: true, classification };
}

function mapContractToLead(
  item: PncpContractItem,
  classification: OpportunityTextClassification,
): IngestionLeadPayload | null {
  const name =
    item.nomeRazaoSocialFornecedor?.trim() ||
    item.orgaoEntidade?.razaoSocial?.trim();

  if (!name) return null;

  const value = item.valorGlobal ?? item.valorInicial ?? undefined;
  const cnpj = item.niFornecedor ?? item.orgaoEntidade?.cnpj;

  return {
    name,
    cnpj,
    source: "PNCP_BID",
    contacts: {
      address: [item.unidadeOrgao?.municipioNome, item.unidadeOrgao?.ufSigla]
        .filter(Boolean)
        .join(" - "),
    },
    metadata: {
      pncp: {
        bidId: item.numeroControlePncpCompra,
        value,
        object: item.objetoContrato,
        date: item.dataAssinatura,
        modality: item.tipoContrato?.nome,
        buyerName: item.orgaoEntidade?.razaoSocial,
        buyerCity: item.unidadeOrgao?.municipioNome,
        buyerState: item.unidadeOrgao?.ufSigla,
        publicationDate: item.dataPublicacaoPncp,
        contractNumber: item.numeroContratoEmpenho,
      },
      opportunity: buildOpportunityMetadata(classification),
    },
  };
}

function mapPublicacaoToLead(
  item: PncpPublicacaoItem,
  classification: OpportunityTextClassification,
): IngestionLeadPayload | null {
  const name =
    item.orgaoEntidade?.razaoSocial?.trim() ||
    item.unidadeOrgao?.nomeUnidade?.trim();

  if (!name) return null;

  const value =
    item.valorTotalHomologado ?? item.valorTotalEstimado ?? undefined;
  const cnpj = item.orgaoEntidade?.cnpj;

  return {
    name,
    cnpj,
    source: "PNCP_BID",
    contacts: {
      address: [item.unidadeOrgao?.municipioNome, item.unidadeOrgao?.ufSigla]
        .filter(Boolean)
        .join(" - "),
    },
    metadata: {
      pncp: {
        bidId: item.numeroControlePNCP,
        value,
        object: item.objetoCompra,
        date: item.dataPublicacaoPncp,
        modality: item.modalidadeNome,
        buyerName: item.orgaoEntidade?.razaoSocial,
        buyerCity: item.unidadeOrgao?.municipioNome,
        buyerState: item.unidadeOrgao?.ufSigla,
        publicationDate: item.dataPublicacaoPncp,
      },
      opportunity: buildOpportunityMetadata(classification),
    },
  };
}

function buildOpportunityMetadata(classification: OpportunityTextClassification) {
  return {
    score: classification.confidence,
    temperature: "COLD" as const,
    category: classification.category,
    confidence: classification.confidence,
    reasons: [],
    penalties: [],
    matchedPositiveTerms: classification.matchedPositiveTerms,
    matchedNegativeTerms: classification.matchedNegativeTerms,
    estimatedDemand: classification.estimatedDemand,
  };
}

async function fetchPncpJson<T>(url: string): Promise<PncpSearchResponse<T> | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }

        await logActivity("warn", "pncp", "PNCP retornou status não OK", {
          status: response.status,
          url,
        });
        return null;
      }

      return (await response.json()) as PncpSearchResponse<T>;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }

      await logActivity("error", "pncp", "Falha ao consultar PNCP", {
        error: error instanceof Error ? error.message : "Unknown error",
        url,
      });
      return null;
    }
  }

  return null;
}

export async function searchPncpPublicacoes(
  params: PncpSearchParams,
  modality: number,
  page = 1,
  pageSize = 50,
): Promise<PncpPageResult> {
  const baseUrl = getBaseUrl();
  const keywords = params.keywords ?? [];
  const { dataInicial, dataFinal } = resolveDateRange(params);
  const parsedRegion = parseRegion(params.region);
  const uf = parsedRegion?.state;

  const query = new URLSearchParams({
    dataInicial,
    dataFinal,
    codigoModalidadeContratacao: String(modality),
    pagina: String(page),
    tamanhoPagina: String(pageSize),
  });

  if (uf) query.set("uf", uf);

  const url = `${baseUrl}/v1/contratacoes/publicacao?${query.toString()}`;
  const data = await fetchPncpJson<PncpPublicacaoItem>(url);

  if (!data) {
    return { leads: [], totalPaginas: 0, discarded: 0 };
  }

  const items = data.data ?? [];
  let discarded = 0;

  const leads = items
    .filter((item) => {
      const objectText = item.objetoCompra ?? "";
      const keywordMatched = matchesKeywords(objectText, keywords, params.object);
      if (!keywordMatched) return false;

      return matchesRegionLocation(
        item.unidadeOrgao?.municipioNome,
        item.unidadeOrgao?.ufSigla,
        params.region,
      );
    })
    .map((item) => {
      const objectText = item.objetoCompra ?? "";
      const keywordMatched = matchesKeywords(objectText, keywords, params.object);
      const value =
        item.valorTotalHomologado ?? item.valorTotalEstimado ?? 0;
      const result = shouldAcceptPncpItem(
        objectText,
        value,
        params,
        keywordMatched,
      );

      if (!result.accepted) {
        discarded += 1;
        return null;
      }

      return mapPublicacaoToLead(item, result.classification);
    })
    .filter((lead): lead is IngestionLeadPayload => lead !== null);

  return {
    leads,
    totalPaginas: data.totalPaginas ?? 0,
    discarded,
  };
}

export async function searchPncpContracts(
  params: PncpSearchParams,
): Promise<PncpPageResult> {
  const baseUrl = getBaseUrl();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const keywords = params.keywords ?? [];
  const { dataInicial, dataFinal } = resolveDateRange(params);

  const query = new URLSearchParams({
    dataInicial,
    dataFinal,
    pagina: String(page),
    tamanhoPagina: String(pageSize),
  });

  const url = `${baseUrl}/v1/contratos?${query.toString()}`;
  const data = await fetchPncpJson<PncpContractItem>(url);

  if (!data) {
    return { leads: [], totalPaginas: 0, discarded: 0 };
  }

  const items = data.data ?? [];
  let discarded = 0;

  const leads = items
    .filter((item) => {
      const objectText = item.objetoContrato ?? "";
      const keywordMatched = matchesKeywords(objectText, keywords, params.object);
      if (!keywordMatched) return false;

      return matchesRegionLocation(
        item.unidadeOrgao?.municipioNome,
        item.unidadeOrgao?.ufSigla,
        params.region,
      );
    })
    .map((item) => {
      const objectText = item.objetoContrato ?? "";
      const keywordMatched = matchesKeywords(objectText, keywords, params.object);
      const value = item.valorGlobal ?? item.valorInicial ?? 0;
      const result = shouldAcceptPncpItem(
        objectText,
        value,
        params,
        keywordMatched,
      );

      if (!result.accepted) {
        discarded += 1;
        return null;
      }

      return mapContractToLead(item, result.classification);
    })
    .filter((lead): lead is IngestionLeadPayload => lead !== null);

  if (discarded > 0 || leads.length > 0) {
    await logActivity("info", "pncp", "PNCP contratos classificados", {
      page,
      accepted: leads.length,
      discarded,
      minValue: params.minValue ?? DEFAULT_MIN_VALUE,
    });
  }

  return {
    leads,
    totalPaginas: data.totalPaginas ?? 0,
    discarded,
  };
}

async function searchPncpPublicacoesAllPages(
  params: PncpSearchParams,
  maxPagesPerModality = MAX_PAGES_PER_MODALITY,
): Promise<IngestionLeadPayload[]> {
  const allLeads: IngestionLeadPayload[] = [];
  const seenKeys = new Set<string>();
  let discarded = 0;

  for (const modality of PNCP_MODALIDADES) {
    let totalPaginas = 1;

    for (
      let batchStart = 1;
      batchStart <= maxPagesPerModality && batchStart <= totalPaginas;
      batchStart += PARALLEL_PAGE_BATCH
    ) {
      const batchEnd = Math.min(
        batchStart + PARALLEL_PAGE_BATCH - 1,
        maxPagesPerModality,
        totalPaginas,
      );
      const pages = Array.from(
        { length: batchEnd - batchStart + 1 },
        (_, index) => batchStart + index,
      );

      const results = await Promise.all(
        pages.map((page) => searchPncpPublicacoes(params, modality, page)),
      );

      if (batchStart === 1) {
        totalPaginas = results[0]?.totalPaginas ?? 0;
      }

      for (const result of results) {
        discarded += result.discarded;
        for (const lead of result.leads) {
          const key = lead.cnpj ?? lead.name.toLowerCase();
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          allLeads.push(lead);
        }
      }

      if (allLeads.length >= TARGET_LEADS) break;
    }

    if (allLeads.length >= TARGET_LEADS) break;
  }

  await logActivity("info", "pncp", "Resumo da busca PNCP (publicações)", {
    accepted: allLeads.length,
    discarded,
    region: params.region,
    minValue: params.minValue ?? DEFAULT_MIN_VALUE,
  });

  return allLeads;
}

async function searchPncpContractsAllPages(
  params: PncpSearchParams,
  maxPages = params.region ? MAX_SCAN_PAGES_WITH_REGION : MAX_SCAN_PAGES,
): Promise<IngestionLeadPayload[]> {
  const allLeads: IngestionLeadPayload[] = [];
  const seenKeys = new Set<string>();
  let totalPaginas = 1;
  let discarded = 0;

  for (
    let batchStart = 1;
    batchStart <= maxPages && batchStart <= totalPaginas;
    batchStart += PARALLEL_PAGE_BATCH
  ) {
    const batchEnd = Math.min(
      batchStart + PARALLEL_PAGE_BATCH - 1,
      maxPages,
      totalPaginas,
    );
    const pages = Array.from(
      { length: batchEnd - batchStart + 1 },
      (_, index) => batchStart + index,
    );

    const results = await Promise.all(
      pages.map((page) => searchPncpContracts({ ...params, page })),
    );

    if (batchStart === 1) {
      totalPaginas = results[0]?.totalPaginas ?? 0;
    }

    for (const result of results) {
      discarded += result.discarded;
      for (const lead of result.leads) {
        const key = lead.cnpj ?? lead.name.toLowerCase();
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        allLeads.push(lead);
      }
    }

    if (allLeads.length >= TARGET_LEADS) break;
  }

  await logActivity("info", "pncp", "Resumo da busca PNCP (contratos)", {
    accepted: allLeads.length,
    discarded,
    maxPages,
    region: params.region,
    minValue: params.minValue ?? DEFAULT_MIN_VALUE,
  });

  return allLeads;
}

export async function searchPncpAllPages(
  params: PncpSearchParams,
): Promise<IngestionLeadPayload[]> {
  const parsedRegion = parseRegion(params.region);
  const hasStateFilter = Boolean(parsedRegion?.state);

  if (hasStateFilter) {
    const publicacaoLeads = await searchPncpPublicacoesAllPages(params);
    if (publicacaoLeads.length >= TARGET_LEADS) {
      return publicacaoLeads.slice(0, TARGET_LEADS);
    }

    const contractLeads = await searchPncpContractsAllPages(params, 10);
    const seenKeys = new Set(publicacaoLeads.map((l) => l.cnpj ?? l.name.toLowerCase()));
    const merged = [...publicacaoLeads];

    for (const lead of contractLeads) {
      const key = lead.cnpj ?? lead.name.toLowerCase();
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      merged.push(lead);
      if (merged.length >= TARGET_LEADS) break;
    }

    return merged.slice(0, TARGET_LEADS);
  }

  return searchPncpContractsAllPages(params);
}
