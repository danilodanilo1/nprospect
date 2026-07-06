"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/input";
import { ScoreBadge, StatusBadge } from "@/components/ui/badge";
import { useLeads } from "@/hooks/useLeads";
import type { LeadDTO, LeadStatus } from "@/types/lead";
import { LEAD_SOURCE_LABELS } from "@/types/lead";
import { formatCnpj, formatCurrency } from "@/lib/utils";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { updateLead, deleteLead } = useLeads();
  const [lead, setLead] = useState<LeadDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/leads/${params.id}`)
      .then((res) => res.json())
      .then((data: LeadDTO & { error?: string }) => {
        if (data.error) throw new Error(data.error);
        setLead(data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleStatusChange(status: LeadStatus) {
    if (!lead) return;
    const updated = await updateLead(lead._id, { status });
    setLead(updated);
  }

  async function handleAddNote(event: React.FormEvent) {
    event.preventDefault();
    if (!lead || !note.trim()) return;
    const updated = await updateLead(lead._id, { notes: note });
    setLead(updated);
    setNote("");
  }

  async function handleEnrich() {
    if (!lead) return;
    setEnriching(true);
    try {
      const response = await fetch(`/api/leads/${lead._id}/enrich`, {
        method: "POST",
      });
      const data = (await response.json()) as LeadDTO & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Erro ao enriquecer");
      setLead(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enriquecer");
    } finally {
      setEnriching(false);
    }
  }

  async function handleDelete() {
    if (!lead || !confirm("Excluir este lead?")) return;
    await deleteLead(lead._id);
    router.push("/leads");
  }

  if (loading) {
    return <p className="text-slate-500">Carregando lead...</p>;
  }

  if (error || !lead) {
    return (
      <div>
        <p className="text-red-600">{error ?? "Lead não encontrado"}</p>
        <Link href="/leads" className="mt-4 inline-block text-amber-700">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para leads
        </Link>
      </div>

      <DashboardHeader title={lead.name} />

      <div className="mb-6 flex flex-wrap gap-3">
        <StatusBadge status={lead.status} />
        <ScoreBadge score={lead.score} />
        {lead.sources.map((source) => (
          <span
            key={source}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium dark:bg-slate-800"
          >
            {LEAD_SOURCE_LABELS[source]}
          </span>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Contatos e dados comerciais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">CNPJ</p>
                <p className="font-medium">{formatCnpj(lead.cnpj)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Telefone</p>
                <p className="font-medium">{lead.contacts.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium">{lead.contacts.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Website</p>
                {lead.contacts.website ? (
                  <a
                    href={lead.contacts.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-amber-700 hover:underline"
                  >
                    Abrir site <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="font-medium">—</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">Endereço</p>
                <p className="font-medium">{lead.contacts.address ?? "—"}</p>
              </div>
            </CardContent>
          </Card>

          {(lead.metadata.google || lead.metadata.pncp || lead.metadata.scraper) && (
            <Card>
              <CardHeader>
                <CardTitle>Dados por fonte de prospecção</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm lg:grid-cols-2">
                {lead.metadata.google && (
                  <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      Google Places
                    </p>
                    <p>
                      Avaliação: {lead.metadata.google.rating ?? "—"} (
                      {lead.metadata.google.reviews ?? 0} reviews)
                    </p>
                    <p>
                      Status Google:{" "}
                      {lead.metadata.google.businessStatus ?? "não informado"}
                    </p>
                    <p>
                      Categorias:{" "}
                      {lead.metadata.google.types?.join(", ") ?? "não informado"}
                    </p>
                    {lead.metadata.google.mapsUrl && (
                      <a
                        href={lead.metadata.google.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-amber-700 hover:underline"
                      >
                        Abrir no Google Maps <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
                {lead.metadata.pncp && (
                  <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      PNCP
                    </p>
                    <p>
                      Órgão: {lead.metadata.pncp.buyerName ?? "não informado"}
                    </p>
                    <p>
                      Local do órgão: {lead.metadata.pncp.buyerCity ?? "—"} -{" "}
                      {lead.metadata.pncp.buyerState ?? "—"}
                    </p>
                    <p>Objeto: {lead.metadata.pncp.object ?? "—"}</p>
                    <p>Valor: {formatCurrency(lead.metadata.pncp.value)}</p>
                    <p>Data assinatura: {lead.metadata.pncp.date ?? "—"}</p>
                    <p>
                      Publicação: {lead.metadata.pncp.publicationDate ?? "—"}
                    </p>
                    <p>Contrato: {lead.metadata.pncp.contractNumber ?? "—"}</p>
                    <p>ID PNCP: {lead.metadata.pncp.bidId ?? "—"}</p>
                  </div>
                )}
                {lead.metadata.scraper && (
                  <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800 lg:col-span-2">
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      Scraper
                    </p>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-900">
                      {JSON.stringify(lead.metadata.scraper, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(lead.prospectingJobs?.length || lead.lastProspectingJobId) && (
            <Card>
              <CardHeader>
                <CardTitle>Histórico de prospecção</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Última busca:{" "}
                  <span className="font-mono text-xs">
                    {lead.lastProspectingJobId ?? "—"}
                  </span>
                </p>
                <p>
                  Total de buscas em que apareceu:{" "}
                  {lead.prospectingJobs?.length ?? 0}
                </p>
              </CardContent>
            </Card>
          )}

          {(lead.metadata.aiSummary || lead.metadata.aiPitch) && (
            <Card>
              <CardHeader>
                <CardTitle>Qualificação IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lead.metadata.aiSummary && (
                  <p>{lead.metadata.aiSummary}</p>
                )}
                {lead.metadata.aiPitch && (
                  <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950/30">
                    <p className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                      Pitch sugerido
                    </p>
                    <p>{lead.metadata.aiPitch}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddNote} className="mb-4 space-y-3">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Adicionar nota..."
                />
                <Button type="submit" size="sm">
                  Salvar nota
                </Button>
              </form>
              <ul className="space-y-3">
                {lead.notes.map((item) => (
                  <li
                    key={item._id ?? item.createdAt}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <p className="text-sm">{item.content}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </li>
                ))}
                {lead.notes.length === 0 && (
                  <p className="text-sm text-slate-500">Nenhuma nota ainda.</p>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  value={lead.status}
                  onChange={(e) =>
                    handleStatusChange(e.target.value as LeadStatus)
                  }
                >
                  <option value="NEW">Novo</option>
                  <option value="CONTACTED">Contatado</option>
                  <option value="QUALIFIED">Qualificado</option>
                  <option value="PROPOSAL">Proposta</option>
                  <option value="WON">Ganho</option>
                  <option value="LOST">Perdido</option>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleEnrich}
                disabled={enriching}
              >
                <Sparkles className="h-4 w-4" />
                {enriching ? "Enriquecendo..." : "Enriquecer com IA"}
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                Excluir lead
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atividade</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">
              <p>
                Criado:{" "}
                {new Date(lead.createdAt).toLocaleString("pt-BR")}
              </p>
              <p className="mt-1">
                Última atividade:{" "}
                {new Date(lead.lastActivityAt).toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
