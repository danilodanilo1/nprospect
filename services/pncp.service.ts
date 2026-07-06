import { logActivity } from "@/services/activity-log.service";
import type { IngestionLeadPayload } from "@/types/ingestion";

export interface PncpSearchParams {
  keywords?: string[];
  object?: string;
  page?: number;
  pageSize?: number;
  /** Formato YYYYMMDD */
  dateFrom?: string;
  /** Formato YYYYMMDD */
  dateTo?: string;
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
  numeroControlePncpCompra?: string;
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
}

const DEFAULT_KEYWORDS = [
  "constru",
  "obra",
  "material",
  "engenharia",
  "reforma",
  "edific",
];

const MAX_SCAN_PAGES = 40;
const PARALLEL_PAGE_BATCH = 5;
const TARGET_LEADS = 50;

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

function mapPncpItemToLead(item: PncpContractItem): IngestionLeadPayload | null {
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
      return { leads: [], totalPaginas: 0 };
    }

    const data = (await response.json()) as PncpSearchResponse;
    const items = data.data ?? [];

    const leads = items
      .filter((item) =>
        matchesKeywords(item.objetoContrato ?? "", keywords, params.object),
      )
      .map(mapPncpItemToLead)
      .filter((lead): lead is IngestionLeadPayload => lead !== null);

    return {
      leads,
      totalPaginas: data.totalPaginas ?? 0,
    };
  } catch (error) {
    await logActivity("error", "pncp", "Falha ao consultar PNCP", {
      error: error instanceof Error ? error.message : "Unknown error",
      url,
    });
    return { leads: [], totalPaginas: 0 };
  }
}

export async function searchPncpAllPages(
  params: PncpSearchParams,
  maxPages = MAX_SCAN_PAGES,
): Promise<IngestionLeadPayload[]> {
  const allLeads: IngestionLeadPayload[] = [];
  const seenKeys = new Set<string>();
  let totalPaginas = 1;

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
      for (const lead of result.leads) {
        const key = lead.cnpj ?? lead.name.toLowerCase();
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        allLeads.push(lead);
      }
    }

    if (allLeads.length >= TARGET_LEADS) break;
  }

  return allLeads;
}
