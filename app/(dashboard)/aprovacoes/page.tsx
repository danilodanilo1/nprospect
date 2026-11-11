"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { InteractionDTO } from "@/components/funnel/types";
import { postJson, useJson } from "@/hooks/useJson";

export default function AprovacoesPage() {
  const { data, error, reload } = useJson<InteractionDTO[]>("/api/interactions?status=PENDENTE&limit=100", 15000);

  return (
    <div>
      <DashboardHeader title="Aprovações" />
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        O que a IA escreveu e espera você. Edite se quiser e aprove: a mensagem vai para a fila e o Guarda libera no horário de envio.
      </p>
      {error && <p className="text-red-600">{error}</p>}
      <div className="space-y-3">
        {(data ?? []).map((i) => (
          <Draft key={i._id} i={i} onDone={reload} />
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-500">Nada esperando você.</p>}
      </div>
    </div>
  );
}

function Draft({ i, onDone }: { i: InteractionDTO; onDone: () => void }) {
  const [subject, setSubject] = useState(i.subject ?? "");
  const [body, setBody] = useState(i.body);
  const [busy, setBusy] = useState(false);
  const lead = typeof i.prospect === "object" ? i.prospect : null;

  async function act(action: "approve" | "reject") {
    setBusy(true);
    try {
      await postJson(`/api/interactions/${i._id}`, { action, subject, body });
      onDone();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {lead && (
            <Link href={`/funil/${lead._id}`} className="font-semibold hover:underline">
              {lead.company}
            </Link>
          )}
          {lead?.email && <span className="text-slate-500">{lead.email}</span>}
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{i.kind}</span>
        </div>
        {i.reason && <p className="text-xs text-slate-500">Motivo: {i.reason}</p>}
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => act("approve")} disabled={busy}>
            Aprovar e enviar
          </Button>
          <Button size="sm" variant="outline" onClick={() => act("reject")} disabled={busy}>
            Descartar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
