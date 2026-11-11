"use client";

import { use, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { OwnerBadge, SignalBadge } from "@/components/funnel/badges";
import { ProspectActions } from "@/components/funnel/prospect-actions";
import { TimelineItem } from "@/components/funnel/timeline";
import type { InteractionDTO, ProspectDTO } from "@/components/funnel/types";
import { postJson, useJson } from "@/hooks/useJson";
import { STAGE_LABELS } from "@/lib/funnel";

export default function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, reload } = useJson<{ prospect: ProspectDTO; interactions: InteractionDTO[] }>(`/api/prospects/${id}`, 15000);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Carregando…</p>;
  const p = data.prospect;

  async function send() {
    setMsg("Colocando na fila…");
    try {
      await postJson(`/api/prospects/${id}/message`, { subject: subject || undefined, body });
      setBody("");
      setSubject("");
      setMsg("Na fila. Sai no próximo ciclo do worker (o Guarda confere antes).");
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <div>
      <Link href="/funil" className="text-sm text-indigo-600 hover:underline">
        ← Funil
      </Link>
      <DashboardHeader title={p.company} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="space-y-3 p-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{STAGE_LABELS[p.stage]}</span>
              <OwnerBadge owner={p.owner} paused={p.paused} />
              <span className="text-slate-500">score {p.score}</span>
            </div>
            <dl className="space-y-1 text-slate-600 dark:text-slate-300">
              {p.contactName && <div>Contato: {p.contactName}</div>}
              {p.email && <div>E-mail: {p.email}</div>}
              {p.phone && <div>Telefone: {p.phone}</div>}
              {p.website && <div>Site: {p.website}</div>}
              {p.city && <div>Cidade: {p.city}</div>}
              <div>Fonte: {p.source}</div>
              {p.nextActionAt && <div>Próximo toque: {new Date(p.nextActionAt).toLocaleDateString("pt-BR")}</div>}
            </dl>
            <div className="space-y-1">
              {p.signals.map((s, i) => (
                <div key={i} className="space-y-0.5">
                  <SignalBadge type={s.type} />
                  {s.evidenceText && <p className="text-xs text-slate-500">{s.evidenceText}</p>}
                  {s.evidenceUrl && (
                    <a href={s.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                      ver evidência
                    </a>
                  )}
                </div>
              ))}
            </div>
            <ProspectActions p={p} onDone={reload} />
          </CardContent>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          {p.stage !== "REMOVER" && p.email && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-medium">Escrever você mesmo {p.owner === "IA" && <span className="font-normal text-slate-500">(ao enviar, você assume o lead)</span>}</p>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto (vazio = responde na mesma conversa)" />
                <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mensagem" />
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={send} disabled={!body.trim()}>
                    Enviar
                  </Button>
                  {msg && <span className="text-xs text-slate-500">{msg}</span>}
                </div>
              </CardContent>
            </Card>
          )}
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Histórico completo</h2>
          {data.interactions.map((i) => (
            <TimelineItem key={i._id} i={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
