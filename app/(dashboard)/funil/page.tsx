"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { OwnerBadge, SignalBadge } from "@/components/funnel/badges";
import { ProspectActions } from "@/components/funnel/prospect-actions";
import type { ProspectDTO, SystemDTO } from "@/components/funnel/types";
import { postJson, useJson } from "@/hooks/useJson";
import { EXIT_STAGES, STAGES, STAGE_LABELS, freshSignals, type AnyStage, type Stage, type StageMode } from "@/lib/funnel";

const MODE_LABEL: Record<StageMode, string> = { AUTO: "Automático", APROVAR: "Aprovar antes", DESLIGADO: "Desligado" };

export default function FunilPage() {
  const { data: prospects, reload } = useJson<ProspectDTO[]>("/api/prospects", 15000);
  const { data: system, reload: reloadSystem } = useJson<SystemDTO>("/api/system", 15000);
  const [showExits, setShowExits] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showModes, setShowModes] = useState(false);

  const byStage = (stage: AnyStage) => (prospects ?? []).filter((p) => p.stage === stage);
  const columns: AnyStage[] = showExits ? [...STAGES, ...EXIT_STAGES] : [...STAGES];

  return (
    <div>
      <DashboardHeader title="Funil de vendas do nRecruit" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowImport((v) => !v)}>
          Importar leads (CSV)
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowModes((v) => !v)}>
          Modo de cada estágio
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowExits((v) => !v)}>
          {showExits ? "Esconder saídas" : "Mostrar descartados, removidos e perdidos"}
        </Button>
      </div>

      {showImport && <ImportBox onDone={reload} />}
      {showModes && system && <ModesBox system={system} onDone={reloadSystem} />}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((stage) => {
          const items = byStage(stage);
          return (
            <div key={stage} className="w-72 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{STAGE_LABELS[stage]}</h2>
                <span className="text-xs text-slate-500">{system?.counts[stage] ?? items.length}</span>
              </div>
              <div className="space-y-2">
                {items.slice(0, 100).map((p) => (
                  <Card key={p._id}>
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/funil/${p._id}`} className="font-medium text-slate-900 hover:underline dark:text-white">
                          {p.company}
                        </Link>
                        <OwnerBadge owner={p.owner} paused={p.paused} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {p.contactName ?? "sem nome"} · score {p.score}
                        {p.touches ? ` · ${p.touches} toque(s)` : ""}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {freshSignals(p.signals).map((s, i) => (
                          <SignalBadge key={i} type={s.type} />
                        ))}
                      </div>
                      <ProspectActions p={p} onDone={reload} />
                    </CardContent>
                  </Card>
                ))}
                {items.length === 0 && <p className="px-1 text-xs text-slate-400">vazio</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImportBox({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [batch, setBatch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg("Importando…");
    try {
      const r = await postJson<{ created: number; updated: number; skipped: number; errors: string[] }>("/api/prospects/import", { csv, batch: batch || undefined });
      setMsg(`${r.created} novos, ${r.updated} atualizados, ${r.skipped} ignorados${r.errors.length ? `, ${r.errors.length} erros` : ""}.`);
      setCsv("");
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="space-y-2 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Colunas: empresa, nome, email, telefone, site, cidade, pessoas, sinal (SEM_ATS, VOLUME_ALTO, EMPRESA_NOVA, CONTRATANDO_RECRUTADOR, INSATISFEITO_CONCORRENTE; vários com |), evidencia, url_evidencia, data_sinal.
          Lead sem sinal nos últimos 14 dias é descartado.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setCsv(await f.text());
          }}
        />
        <Textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="ou cole o CSV aqui" />
        <div className="flex gap-2">
          <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="nome do lote (opcional)" className="max-w-xs" />
          <Button size="sm" onClick={submit} disabled={!csv}>
            Importar
          </Button>
        </div>
        {msg && <p className="text-sm text-slate-600 dark:text-slate-300">{msg}</p>}
      </CardContent>
    </Card>
  );
}

function ModesBox({ system, onDone }: { system: SystemDTO; onDone: () => void }) {
  async function setMode(stage: Stage, mode: StageMode) {
    await postJson("/api/system", { stageModes: { [stage]: mode } }, "PATCH");
    onDone();
  }
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          &quot;Aprovar antes&quot;: a IA escreve e espera você em Aprovações. &quot;Automático&quot;: envia sozinha (sempre passando pelo Guarda). &quot;Desligado&quot;: o estágio não anda.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((stage) => (
            <label key={stage} className="flex items-center justify-between gap-2 text-sm">
              <span>{STAGE_LABELS[stage]}</span>
              <select
                className="rounded-md border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-slate-700"
                value={system.stageModes[stage]}
                onChange={(e) => setMode(stage, e.target.value as StageMode)}
              >
                {(Object.keys(MODE_LABEL) as StageMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
