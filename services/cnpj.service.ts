import CnpjCache from "@/models/CnpjCache";
import { connectDB } from "@/lib/db";
import { normalizeCnpj } from "@/lib/utils";
import { normalizeOpportunityText } from "@/services/opportunity-rules.service";
import { logActivity } from "@/services/activity-log.service";
import type { CnpjDataMetadata } from "@/types/lead";

interface BrasilApiCnae {
  codigo?: number;
  descricao?: string;
}

interface BrasilApiCnpjResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: BrasilApiCnae[];
  municipio?: string;
  uf?: string;
  porte?: string;
  ddd_telefone_1?: string;
  email?: string;
}

const POSITIVE_CNAE_TERMS = [
  "construção",
  "construcao",
  "obra",
  "alvenaria",
  "acabamento",
  "instalação elétrica",
  "instalacao eletrica",
  "instalações hidráulicas",
  "instalacoes hidraulicas",
  "engenharia",
  "terraplenagem",
  "pavimentação",
  "pavimentacao",
  "impermeabilização",
  "impermeabilizacao",
  "estrutura",
];

const NEGATIVE_CNAE_TERMS = [
  "limpeza",
  "papelaria",
  "aliment",
  "informática",
  "informatica",
  "administrativ",
  "escritório",
  "escritorio",
];

function classifyCnae(descriptions: string[]): CnpjDataMetadata["sectorMatch"] {
  const normalized = normalizeOpportunityText(descriptions.join(" "));

  if (
    POSITIVE_CNAE_TERMS.some((term) =>
      normalized.includes(normalizeOpportunityText(term)),
    )
  ) {
    return "CONSTRUCTION";
  }

  if (
    NEGATIVE_CNAE_TERMS.some((term) =>
      normalized.includes(normalizeOpportunityText(term)),
    )
  ) {
    return "NEGATIVE";
  }

  return "UNKNOWN";
}

function mapBrasilApiResponse(data: BrasilApiCnpjResponse): CnpjDataMetadata {
  const secondaryCnaes =
    data.cnaes_secundarios
      ?.map((cnae) => cnae.descricao)
      .filter((description): description is string => Boolean(description)) ??
    [];
  const descriptions = [data.cnae_fiscal_descricao, ...secondaryCnaes].filter(
    (description): description is string => Boolean(description),
  );

  return {
    legalName: data.razao_social,
    tradeName: data.nome_fantasia,
    status: data.descricao_situacao_cadastral,
    mainCnae: data.cnae_fiscal ? String(data.cnae_fiscal) : undefined,
    mainCnaeDescription: data.cnae_fiscal_descricao,
    secondaryCnaes,
    city: data.municipio,
    state: data.uf,
    size: data.porte,
    sectorMatch: classifyCnae(descriptions),
  };
}

export async function enrichCnpjData(
  cnpj: string | undefined,
): Promise<CnpjDataMetadata | undefined> {
  const normalized = normalizeCnpj(cnpj);
  if (!normalized) return undefined;

  await connectDB();

  const cached = await CnpjCache.findOne({ cnpj: normalized }).lean();
  if (cached?.data) return cached.data;

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${normalized}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3500),
        next: { revalidate: 60 * 60 * 24 * 30 },
      },
    );

    if (!response.ok) {
      await logActivity("warn", "cnpj", "Consulta CNPJ retornou status não OK", {
        cnpj: normalized,
        status: response.status,
      });
      return undefined;
    }

    const data = mapBrasilApiResponse(
      (await response.json()) as BrasilApiCnpjResponse,
    );

    await CnpjCache.findOneAndUpdate(
      { cnpj: normalized },
      { cnpj: normalized, data, fetchedAt: new Date() },
      { upsert: true, new: true },
    );

    return data;
  } catch (error) {
    await logActivity("warn", "cnpj", "Falha ao consultar CNPJ", {
      cnpj: normalized,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return undefined;
  }
}
