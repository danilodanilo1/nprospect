"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { postJson } from "@/hooks/useJson";
import type { ProspectDTO } from "./types";

export function ProspectActions({ p, onDone, size = "sm" }: { p: ProspectDTO; onDone: () => void; size?: "sm" | "default" }) {
  const [busy, setBusy] = useState(false);
  const closed = p.stage === "REMOVER";

  async function act(action: string) {
    if (action === "remove" && !window.confirm(`Remover ${p.company} para sempre? O e-mail entra na lista de bloqueio.`)) return;
    setBusy(true);
    try {
      await postJson(`/api/prospects/${p._id}`, { action });
      onDone();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (closed) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {p.owner === "IA" ? (
        <Button size={size} onClick={() => act("takeover")} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700">
          Assumir
        </Button>
      ) : (
        <Button size={size} variant="outline" onClick={() => act("release")} disabled={busy}>
          Devolver à IA
        </Button>
      )}
      <Button size={size} variant="outline" onClick={() => act(p.paused ? "resume" : "pause")} disabled={busy}>
        {p.paused ? "Retomar" : "Pausar"}
      </Button>
      <Button size={size} variant="ghost" onClick={() => act("remove")} disabled={busy} className="text-red-600">
        Remover
      </Button>
    </div>
  );
}
