import { logActivity } from "@/services/activity-log.service";
import { matchesRegionLocation } from "@/lib/region";
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

interface PncpSearchResponse {
  data?: PncpContractItem[];
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

const MAX_SCAN_PAGES = 40;
const MAX_SCAN_PAGES_WITH_REGION = 80;
const PARALLEL_PAGE_BATCH = 5;
const TARGET_LEADS = 50;
const DEFAULT_MIN_VALUE = 50_000;

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

function matchesKeywords(text: string, keywords: string[], objectFilter?: string): boolean {
  const normalizedText = normalizeText(text);
  const terms = collectSearchTerms(keywords, objectFilter);
  return terms.some((term) => normalizedText.includes(term));
}

function shouldAcceptPncpItem(
  item: PncpContractItem,
  params: PncpSearchParams,
): {
  accepted: boolean;
  classification: OpportunityTextClassification;
  value: number;
  rejectionReason?: string;
} {
  const objectText = item.objetoContrato ?? "";
  const classification = classifyOpportunityText(objectText);
  const value = item.valorGlobal ?? item.valorInicial ?? 0;
  const minValue = params.minValue ?? DEFAULT_MIN_VALUE;

  if (classification.category === "NOISE") {
    return {
      accepted: false,
      classification,
      value,
      rejectionReason: "Objeto contém termos negativos fora de obras",
    };
  }

  if (value < minValue) {
    return {
      accepted: false,
      classification,
      value,
      rejectionReason: `Valor abaixo do mínimo de R$ ${minValue}`,
    };
  }

  if (
    classification.category !== "CONSTRUCTION" &&
    classification.category !== "MATERIALS"
  ) {
    return {
      accepted: false,
      classification,
      value,
      rejectionReason: "Objeto sem intenção clara de obra ou material de construção",
    };
  }

  return { accepted: true, classification, value };
}

function mapPncpItemToLead(
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
      opportunity: {
        score: classification.confidence,
        temperature: "COLD",
        category: classification.category,
        confidence: classification.confidence,
        reasons: [],
        penalties: [],
        matchedPositiveTerms: classification.matchedPositiveTerms,
        matchedNegativeTerms: classification.matchedNegativeTerms,
        estimatedDemand: classification.estimatedDemand,
      },
    },
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

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      await logActivity("warn", "pncp", "PNCP retornou status não OK", {
        status: response.status,
        url,
      });
      return { leads: [], totalPaginas: 0, discarded: 0 };
    }

    const data = (await response.json()) as PncpSearchResponse;
    const items = data.data ?? [];
    let discarded = 0;

    const leads = items
      .filter((item) =>
        matchesKeywords(item.objetoContrato ?? "", keywords, params.object),
      )
      .filter((item) =>
        matchesRegionLocation(
          item.unidadeOrgao?.municipioNome,
          item.unidadeOrgao?.ufSigla,
          params.region,
        ),
      )
      .map((item) => {
        const result = shouldAcceptPncpItem(item, params);
        if (!result.accepted) {
          discarded += 1;
          return null;
        }
        return mapPncpItemToLead(item, result.classification);
      })
      .filter((lead): lead is IngestionLeadPayload => lead !== null);

    if (discarded > 0 || leads.length > 0) {
      await logActivity("info", "pncp", "PNCP classificados por oportunidade", {
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
  } catch (error) {
    await logActivity("error", "pncp", "Falha ao consultar PNCP", {
      error: error instanceof Error ? error.message : "Unknown error",
      url,
    });
    return { leads: [], totalPaginas: 0, discarded: 0 };
  }
}

export async function searchPncpAllPages(
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

  await logActivity("info", "pncp", "Resumo da busca PNCP", {
    accepted: allLeads.length,
    discarded,
    maxPages,
    region: params.region,
    minValue: params.minValue ?? DEFAULT_MIN_VALUE,
  });

  return allLeads;
}
