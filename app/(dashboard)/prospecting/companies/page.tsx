"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink, Play, RefreshCw } from "lucide-react";
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

const SEGMENTS = [
  "construtora",
  "empreiteira",
  "engenharia civil",
  "manutenção predial",
  "reforma comercial",
  "instalações elétricas",
  "instalações hidráulicas",
  "terraplenagem",
  "pavimentação",
  "incorporadora",
];

export default function CompaniesProspectingPage() {
  const { jobs, loading, searching, error, lastJob, fetchJobs, startSearch } =
    useProspecting();
  const { leads, pagination, fetchLeads } = useLeads({
    source: "GOOGLE_PLACES",
    region: "São Paulo, SP",
    limit: 10,
  });

  const [segment, setSegment] = useState("construtora");
  const [customSegment, setCustomSegment] = useState("");
  const [region, setRegion] = useState("São Paulo, SP");
  const [radiusKm, setRadiusKm] = useState("25");

  useEffect(() => {
    fetchJobs("GOOGLE_PLACES");
    fetchLeads({
      source: "GOOGLE_PLACES",
      region,
      page: 1,
      limit: 10,
    });
  }, [fetchJobs, fetchLeads, region]);

  const query = customSegment.trim() || segment;

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const job = await startSearch({
      region,
      radiusKm: Number(radiusKm),
      keywords: [query],
      sources: ["GOOGLE_PLACES"],
    });

    await fetchJobs("GOOGLE_PLACES");
    await fetchLeads({
      source: "GOOGLE_PLACES",
      region,
      jobId: job?._id,
      page: 1,
      limit: 10,
    });
  }

  async function goToPage(page: number) {
    await fetchLeads({
      source: "GOOGLE_PLACES",
      region,
      page,
      limit: 10,
    });
  }

  return (
    <div>
      <DashboardHeader title="Prospecção Empresas" />
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Encontre construtoras, empreiteiras, engenharias e outros segmentos no
        Google Places. Clique em &quot;Buscar empresas&quot; para trazer novos
        resultados.
      </p>

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-medium">Google Places requer chave de API</p>
        <p className="mt-1">
          Para buscar empresas, configure{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">
            GOOGLE_PLACES_API_KEY
          </code>{" "}
          no arquivo <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.env.local</code>{" "}
          e reinicie o servidor. Sem essa chave, a busca retorna zero resultados.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nova busca Google Places</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div>
                  <Label htmlFor="segment">Segmento</Label>
                  <Select
                    id="segment"
                    value={segment}
                    onChange={(event) => setSegment(event.target.value)}
                  >
                    {SEGMENTS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="customSegment">Ou termo livre</Label>
                  <Input
                    id="customSegment"
                    placeholder="ex.: concreto usinado"
                    value={customSegment}
                    onChange={(event) => setCustomSegment(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="region">Região</Label>
                  <Input
                    id="region"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    placeholder="São Paulo, SP"
                  />
                </div>
                <div>
                  <Label htmlFor="radius">Raio aproximado (km)</Label>
                  <Input
                    id="radius"
                    type="number"
                    min={1}
                    max={100}
                    value={radiusKm}
                    onChange={(event) => setRadiusKm(event.target.value)}
                  />
                </div>
                <Button type="submit" disabled={searching} className="w-full">
                  <Play className="h-4 w-4" />
                  {searching ? "Buscando..." : "Buscar empresas"}
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
              <CardTitle>Empresas encontradas</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  fetchLeads({
                    source: "GOOGLE_PLACES",
                    region,
                    page: pagination.page,
                    limit: 10,
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
                      <th className="py-3 pr-4 font-medium">Contato</th>
                      <th className="py-3 pr-4 font-medium">Oportunidade</th>
                      <th className="py-3 pr-4 font-medium">Avaliação</th>
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
                          <p className="mt-1 max-w-sm text-xs text-slate-500">
                            {lead.contacts.address ?? "Endereço não informado"}
                          </p>
                        </td>
                        <td className="py-3 pr-4 align-top text-xs">
                          <p>{lead.contacts.phone ?? "Telefone não informado"}</p>
                          {lead.contacts.website && (
                            <a
                              className="mt-1 inline-flex items-center gap-1 text-amber-700 hover:underline"
                              href={lead.contacts.website}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Site <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
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
                              "Empresa em segmento-alvo"}
                          </p>
                        </td>
                        <td className="py-3 pr-4 align-top text-xs">
                          <p>{lead.metadata.google?.rating ?? "—"} estrelas</p>
                          <p className="text-slate-500">
                            {lead.metadata.google?.reviews ?? 0} reviews
                          </p>
                          {lead.metadata.google?.mapsUrl && (
                            <a
                              className="mt-1 inline-flex items-center gap-1 text-amber-700 hover:underline"
                              href={lead.metadata.google.mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Maps <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
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
                  Nenhuma empresa salva ainda. Configure a chave do Google Places
                  no .env.local e clique em &quot;Buscar empresas&quot;.
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
              <CardTitle>Histórico Google Places</CardTitle>
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
                        {job.filters.keywords?.join(", ")} •{" "}
                        {job.filters.region ?? "Brasil"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  Nenhuma busca Google realizada.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
