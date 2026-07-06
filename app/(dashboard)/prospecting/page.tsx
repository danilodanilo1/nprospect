"use client";

import { useEffect, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { useProspecting } from "@/hooks/useProspecting";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProspectingPage() {
  const { jobs, loading, searching, error, lastJob, fetchJobs, startSearch } =
    useProspecting();

  const [region, setRegion] = useState("São Paulo, SP");
  const [keywords, setKeywords] = useState("construtora, obra, engenharia");
  const [pncpObject, setPncpObject] = useState("material construção");
  const [radiusKm, setRadiusKm] = useState("25");
  const [googleEnabled, setGoogleEnabled] = useState(true);
  const [pncpEnabled, setPncpEnabled] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();

    const sources: ("GOOGLE_PLACES" | "PNCP_BID")[] = [];
    if (googleEnabled) sources.push("GOOGLE_PLACES");
    if (pncpEnabled) sources.push("PNCP_BID");

    await startSearch({
      region: region || undefined,
      radiusKm: Number(radiusKm),
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      pncpObject: pncpObject || undefined,
      sources,
    });
  }

  return (
    <div>
      <DashboardHeader title="Prospecção" />

      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        Motor de busca: consulta PNCP e Google Places e salva os resultados em{" "}
        <strong>Leads</strong>. &quot;São Paulo, SP&quot; inclui todo o{" "}
        <strong>estado</strong> (Campinas, Osasco, capital etc.). Para uma cidade
        específica, use ex.: &quot;Campinas, SP&quot;.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nova Busca</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <Label htmlFor="region">Região</Label>
                <Input
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="São Paulo, SP (estado) ou Campinas, SP"
                />
              </div>
              <div>
                <Label htmlFor="keywords">Palavras-chave</Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pncpObject">Objeto PNCP</Label>
                <Input
                  id="pncpObject"
                  value={pncpObject}
                  onChange={(e) => setPncpObject(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="radius">Raio (km) — Google Places</Label>
                <Input
                  id="radius"
                  type="number"
                  min={1}
                  max={100}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={googleEnabled}
                    onChange={(e) => setGoogleEnabled(e.target.checked)}
                  />
                  Google Places
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={pncpEnabled}
                    onChange={(e) => setPncpEnabled(e.target.checked)}
                  />
                  PNCP
                </label>
              </div>
              <Button type="submit" disabled={searching} className="w-full">
                <Play className="h-4 w-4" />
                {searching ? "Buscando..." : "Iniciar prospecção"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {lastJob && (
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader>
                <CardTitle>Último Resultado</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>Status: {lastJob.status}</p>
                <p>Leads encontrados: {lastJob.leadsFound}</p>
                {lastJob.ingestion && (
                  <p className="mt-2 text-slate-500">
                    Criados: {lastJob.ingestion.created} | Atualizados:{" "}
                    {lastJob.ingestion.updated} | Erros: {lastJob.ingestion.errors}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Histórico de Jobs</CardTitle>
              <Button variant="ghost" size="icon" onClick={fetchJobs}>
                <RefreshCw className="h-4 w-4" />
              </Button>
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
                      className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{job.status}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(job.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                        {job.leadsFound} leads
                      </p>
                      {job.filters.region && (
                        <p className="text-xs text-slate-500">
                          Região: {job.filters.region}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  Nenhuma busca realizada ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
