"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Play, RefreshCw, Trophy } from "lucide-react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { useLeads } from "@/hooks/useLeads";
import { useProspecting } from "@/hooks/useProspecting";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ScoreBadge,
  StatusBadge,
  TemperatureBadge,
} from "@/components/ui/badge";
import { formatCnpj, formatCurrency } from "@/lib/utils";

function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function dateRangeFromDays(days: number): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - days);
  return {
    dateFrom: formatDateYYYYMMDD(from),
    dateTo: formatDateYYYYMMDD(today),
  };
}

export default function BidsProspectingPage() {
  const { jobs, loading, searching, error, lastJob, fetchJobs, startSearch } =
    useProspecting();
  const { leads, pagination, fetchLeads } = useLeads({
    source: "PNCP_BID",
    region: "São Paulo, SP",
    opportunityOnly: true,
    limit: 10,
  });

  const [region, setRegion] = useState("São Paulo, SP");
  const [pncpObject, setPncpObject] = useState(
    "obra, reforma, construção, ampliação, manutenção predial",
  );
  const [keywords, setKeywords] = useState("engenharia, alvenaria, hidráulica, elétrica");
  const [periodDays, setPeriodDays] = useState("90");
  const [minValue, setMinValue] = useState("50000");
  const [opportunityLevel, setOpportunityLevel] = useState("WARM_AND_HOT");

  const period = useMemo(
    () => dateRangeFromDays(Number(periodDays)),
    [periodDays],
  );

  useEffect(() => {
    fetchJobs("PNCP_BID");
    fetchLeads({
      source: "PNCP_BID",
      region,
      page: 1,
      limit: 10,
      opportunityOnly: true,
      ...(opportunityLevel === "HOT_ONLY" ? { temperature: "HOT" as const } : {}),
      ...(opportunityLevel === "WARM_AND_HOT" ? { minScore: 45 } : {}),
    });
  }, [fetchJobs, fetchLeads, region, opportunityLevel]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const job = await startSearch({
      region,
      keywords: keywords.split(",").map((item) => item.trim()).filter(Boolean),
      pncpObject: pncpObject || undefined,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      minValue: minValue ? Number(minValue) : undefined,
      sources: ["PNCP_BID"],
    });

    await fetchJobs("PNCP_BID");
    await fetchLeads({
      source: "PNCP_BID",
      region,
      jobId: job?._id,
      page: 1,
      limit: 10,
      opportunityOnly: true,
      ...(opportunityLevel === "HOT_ONLY" ? { temperature: "HOT" as const } : {}),
      ...(opportunityLevel === "WARM_AND_HOT" ? { minScore: 45 } : {}),
    });
  }

  async function goToPage(page: number) {
    await fetchLeads({
      source: "PNCP_BID",
      region,
      page,
      limit: 10,
      opportunityOnly: true,
      ...(opportunityLevel === "HOT_ONLY" ? { temperature: "HOT" as const } : {}),
      ...(opportunityLevel === "WARM_AND_HOT" ? { minScore: 45 } : {}),
    });
  }

  return (
    <div>
      <DashboardHeader title="Prospecção Licitações" />
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        Encontre empresas que venceram contratos públicos relacionados a obras,
        reformas, engenharia e materiais. A região PNCP considera o órgão
        contratante; o fornecedor pode estar em outra cidade.
      </p>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nova busca PNCP</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div>
                  <Label htmlFor="region">Região/UF do órgão</Label>
                  <Input
                    id="region"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    placeholder="São Paulo, SP ou Campinas, SP"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    São Paulo, SP inclui todo o estado. Use Campinas, SP para
                    uma cidade específica.
                  </p>
                </div>
                <div>
                  <Label htmlFor="pncpObject">Objeto da licitação</Label>
                  <Input
                    id="pncpObject"
                    value={pncpObject}
                    onChange={(event) => setPncpObject(event.target.value)}
                    placeholder="obra, reforma, material"
                  />
                </div>
                <div>
                  <Label htmlFor="keywords">Palavras-chave extras</Label>
                  <Input
                    id="keywords"
                    value={keywords}
                    onChange={(event) => setKeywords(event.target.value)}
                    placeholder="construção, engenharia"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="period">Período</Label>
                    <Select
                      id="period"
                      value={periodDays}
                      onChange={(event) => setPeriodDays(event.target.value)}
                    >
                      <option value="30">Últimos 30 dias</option>
                      <option value="90">Últimos 90 dias</option>
                      <option value="180">Últimos 180 dias</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="minValue">Valor mínimo</Label>
                    <Input
                      id="minValue"
                      type="number"
                      min={0}
                      value={minValue}
                      onChange={(event) => setMinValue(event.target.value)}
                      placeholder="100000"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="opportunityLevel">Nível de oportunidade</Label>
                  <Select
                    id="opportunityLevel"
                    value={opportunityLevel}
                    onChange={(event) => setOpportunityLevel(event.target.value)}
                  >
                    <option value="HOT_ONLY">Quentes apenas</option>
                    <option value="WARM_AND_HOT">Quentes e médias</option>
                    <option value="ALL">Todas exceto descartadas</option>
                  </Select>
                </div>
                <Button type="submit" disabled={searching} className="w-full">
                  <Play className="h-4 w-4" />
                  {searching ? "Buscando PNCP..." : "Buscar licitações"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {lastJob && (
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader>
                <CardTitle>Última busca</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>Status: {lastJob.status}</p>
                <p>Leads encontrados: {lastJob.leadsFound}</p>
                {lastJob.ingestion && (
                  <p className="mt-2 text-slate-500">
                    Criados: {lastJob.ingestion.created} | Atualizados:{" "}
                    {lastJob.ingestion.updated} | Erros:{" "}
                    {lastJob.ingestion.errors}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Vencedores encontrados</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  fetchLeads({
                    source: "PNCP_BID",
                    region,
                    page: pagination.page,
                    limit: 10,
                    opportunityOnly: true,
                    ...(opportunityLevel === "HOT_ONLY"
                      ? { temperature: "HOT" as const }
                      : {}),
                    ...(opportunityLevel === "WARM_AND_HOT"
                      ? { minScore: 45 }
                      : {}),
                  })
                }
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 pr-4 font-medium">Empresa</th>
                      <th className="py-3 pr-4 font-medium">Licitação</th>
                      <th className="py-3 pr-4 font-medium">Oportunidade</th>
                      <th className="py-3 pr-4 font-medium">Valor/Data</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr
                        key={lead._id}
                        className="border-b border-slate-100 dark:border-slate-900"
                      >
                        <td className="py-3 pr-4 align-top">
                          <Link
                            href={`/leads/${lead._id}`}
                            className="font-medium text-amber-700 hover:underline dark:text-amber-400"
                          >
                            {lead.name}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatCnpj(lead.cnpj)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Órgão: {lead.metadata.pncp?.buyerName ?? "—"}
                          </p>
                        </td>
                        <td className="max-w-md py-3 pr-4 align-top text-xs">
                          <p>{lead.metadata.pncp?.object ?? "Objeto não informado"}</p>
                          <p className="mt-1 text-slate-500">
                            {lead.metadata.pncp?.buyerCity ?? "—"} -{" "}
                            {lead.metadata.pncp?.buyerState ?? "—"}
                          </p>
                          <p className="text-slate-500">
                            ID: {lead.metadata.pncp?.bidId ?? "—"}
                          </p>
                        </td>
                        <td className="py-3 pr-4 align-top text-xs">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <TemperatureBadge
                              temperature={lead.metadata.opportunity?.temperature}
                            />
                            <ScoreBadge score={lead.score} />
                          </div>
                          <p className="max-w-xs text-slate-600 dark:text-slate-400">
                            {lead.metadata.opportunity?.reasons[0] ??
                              "Sem motivo registrado"}
                          </p>
                          {lead.metadata.opportunity?.estimatedDemand?.length ? (
                            <p className="mt-1 text-slate-500">
                              Demanda:{" "}
                              {lead.metadata.opportunity.estimatedDemand
                                .slice(0, 3)
                                .join(", ")}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4 align-top text-xs">
                          <p>{formatCurrency(lead.metadata.pncp?.value)}</p>
                          <p className="mt-1 inline-flex items-center gap-1 text-slate-500">
                            <CalendarDays className="h-3 w-3" />
                            {lead.metadata.pncp?.date ??
                              lead.metadata.pncp?.publicationDate ??
                              "—"}
                          </p>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="flex flex-col gap-2">
                            <StatusBadge status={lead.status} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {leads.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nenhum vencedor encontrado ainda. Rode uma busca PNCP.
                </p>
              )}
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Página {pagination.page} de {Math.max(pagination.pages, 1)} •{" "}
                  {pagination.total} leads
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => goToPage(pagination.page - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => goToPage(pagination.page + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico PNCP</CardTitle>
            </CardHeader>
            <CardContent>
              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
              {loading ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : jobs.length ? (
                <ul className="space-y-3">
                  {jobs.map((job) => (
                    <li
                      key={job._id}
                      className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{job.status}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(job.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-amber-700 dark:text-amber-400">
                        {job.leadsFound} leads
                      </p>
                      <p className="text-xs text-slate-500">
                        {job.filters.pncpObject ?? "obra/material"} •{" "}
                        {job.filters.region ?? "Brasil"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  Nenhuma busca PNCP realizada.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
