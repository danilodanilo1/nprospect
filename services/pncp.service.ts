import { logActivity } from "@/services/activity-log.service";
import type { IngestionLeadPayload } from "@/types/ingestion";

export interface PncpSearchParams {
  keywords?: string[];
  object?: string;
  page?: number;
  pageSize?: number;
}

interface PncpContractItem {
  orgaoEntidade?: { razaoSocial?: string; cnpj?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string };
  valorTotalEstimado?: number;
  valorTotalHomologado?: number;
  objetoContrato?: string;
  dataAssinatura?: string;
  numeroControlePNCP?: string;
  modalidadeNome?: string;
}

interface PncpSearchResponse {
  data?: PncpContractItem[];
  totalRegistros?: number;
  totalPaginas?: number;
}

function getBaseUrl(): string {
  return (
    process.env.PNCP_BASE_URL ?? "https://pncp.gov.br/api/pncp"
  ).replace(/\/$/, "");
}

function matchesConstructionKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  const defaults = [
    "constru",
    "obra",
    "material",
    "engenharia",
    "reforma",
    "edific",
  ];
  const terms = keywords.length > 0 ? keywords : defaults;
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function mapPncpItemToLead(item: PncpContractItem): IngestionLeadPayload | null {
  const name = item.orgaoEntidade?.razaoSocial?.trim();
  if (!name) return null;

  const value =
    item.valorTotalHomologado ?? item.valorTotalEstimado ?? undefined;

  return {
    name,
    cnpj: item.orgaoEntidade?.cnpj,
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
        object: item.objetoContrato,
        date: item.dataAssinatura,
        modality: item.modalidadeNome,
      },
    },
  };
}

export async function searchPncpContracts(
  params: PncpSearchParams,
): Promise<IngestionLeadPayload[]> {
  const baseUrl = getBaseUrl();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const keywords = params.keywords ?? [];

  const query = new URLSearchParams({
    pagina: String(page),
    tamanhoPagina: String(pageSize),
  });

  if (params.object) {
    query.set("objetoContrato", params.object);
  }

  const url = `${baseUrl}/v1/contratos?${query.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      await logActivity("warn", "pncp", "PNCP retornou status não OK", {
        status: response.status,
        url,
      });
      return [];
    }

    const data = (await response.json()) as PncpSearchResponse;
    const items = data.data ?? [];

    return items
      .filter((item) => {
        const objectText = item.objetoContrato ?? "";
        if (params.object) return true;
        return matchesConstructionKeywords(objectText, keywords);
      })
      .map(mapPncpItemToLead)
      .filter((lead): lead is IngestionLeadPayload => lead !== null);
  } catch (error) {
    await logActivity("error", "pncp", "Falha ao consultar PNCP", {
      error: error instanceof Error ? error.message : "Unknown error",
      url,
    });
    return [];
  }
}

export async function searchPncpAllPages(
  params: PncpSearchParams,
  maxPages = 3,
): Promise<IngestionLeadPayload[]> {
  const allLeads: IngestionLeadPayload[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const pageResults = await searchPncpContracts({ ...params, page });
    allLeads.push(...pageResults);
    if (pageResults.length === 0) break;
  }

  return allLeads;
}
