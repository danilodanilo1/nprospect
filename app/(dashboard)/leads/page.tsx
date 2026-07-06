"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { useLeads } from "@/hooks/useLeads";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge, StatusBadge } from "@/components/ui/badge";
import { LEAD_SOURCE_LABELS, type LeadStatus } from "@/types/lead";
import { formatCnpj } from "@/lib/utils";

export default function LeadsPage() {
  const { leads, loading, error, fetchLeads, createLead } = useLeads({
    region: "São Paulo, SP",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [regionFilter, setRegionFilter] = useState("São Paulo, SP");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCnpj, setFormCnpj] = useState("");

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  async function handleSearch() {
    await fetchLeads({
      search: search || undefined,
      status: statusFilter || undefined,
      region: regionFilter || undefined,
    });
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    await createLead({ name: formName, cnpj: formCnpj });
    setFormName("");
    setFormCnpj("");
    setShowForm(false);
  }

  return (
    <div>
      <DashboardHeader title="Leads" />

      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        CRM com empresas já salvas no banco. &quot;São Paulo, SP&quot; = todo o
        estado. Para buscar novas oportunidades, use{" "}
        <Link href="/prospecting" className="font-medium text-amber-700 hover:underline dark:text-amber-400">
          Prospecção
        </Link>
        .
      </p>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              placeholder="Nome ou CNPJ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as LeadStatus | "")
              }
            >
              <option value="">Todos</option>
              <option value="NEW">Novo</option>
              <option value="CONTACTED">Contatado</option>
              <option value="QUALIFIED">Qualificado</option>
              <option value="PROPOSAL">Proposta</option>
              <option value="WON">Ganho</option>
              <option value="LOST">Perdido</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="region">Região</Label>
            <Input
              id="region"
              placeholder="São Paulo, SP"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSearch} className="w-full">
              <Search className="h-4 w-4" />
              Filtrar
            </Button>
          </div>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formCnpj}
                  onChange={(e) => setFormCnpj(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Salvar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="text-slate-500">Carregando leads...</p>}

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Local</th>
              <th className="px-4 py-3 font-medium">CNPJ</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Fontes</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead._id}
                className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/leads/${lead._id}`}
                    className="font-medium text-amber-700 hover:underline dark:text-amber-400"
                  >
                    {lead.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {lead.contacts.address || "—"}
                </td>
                <td className="px-4 py-3">{formatCnpj(lead.cnpj)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3">
                  <ScoreBadge score={lead.score} />
                </td>
                <td className="px-4 py-3">
                  {lead.sources.map((s) => LEAD_SOURCE_LABELS[s]).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:hidden">
        {leads.map((lead) => (
          <Card key={lead._id}>
            <CardContent className="p-4">
              <Link
                href={`/leads/${lead._id}`}
                className="font-semibold text-amber-700 dark:text-amber-400"
              >
                {lead.name}
              </Link>
              <p className="mt-1 text-sm text-slate-500">
                {lead.contacts.address || "Local não informado"}
              </p>
              <p className="text-sm text-slate-500">{formatCnpj(lead.cnpj)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={lead.status} />
                <ScoreBadge score={lead.score} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && leads.length === 0 && (
        <p className="mt-8 text-center text-slate-500">
          Nenhum lead encontrado. Crie um manualmente ou inicie uma prospecção.
        </p>
      )}
    </div>
  );
}
