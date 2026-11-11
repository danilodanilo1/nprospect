"use client";

import { useState } from "react";
import Link from "next/link";
import { Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { postJson, useJson } from "@/hooks/useJson";
import type { SystemDTO } from "./types";

/** O botão único: liga e desliga a busca e o contato com clientes. */
export function SystemToggle() {
  const { data, reload } = useJson<SystemDTO>("/api/system", 10000);
  const [busy, setBusy] = useState(false);
  const running = data?.running ?? false;

  async function toggle() {
    setBusy(true);
    try {
      await postJson("/api/system", { running: !running }, "PATCH");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-3 mb-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <button
        onClick={toggle}
        disabled={busy || !data}
        aria-pressed={running}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60",
          running ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-500 hover:bg-slate-600",
        )}
      >
        <Power className="h-4 w-4" />
        {running ? "Ligado: clique para desligar" : "Desligado: clique para ligar"}
      </button>
      <div className="mt-2 space-y-1 text-xs text-slate-500">
        <p>
          Worker:{" "}
          <span className={data?.workerOnline ? "text-emerald-600" : "text-red-600"}>
            {data ? (data.workerOnline ? "rodando" : "parado (rode npm run worker)") : "…"}
          </span>
        </p>
        {data?.pausedReason && !running && <p className="text-amber-700 dark:text-amber-400">Motivo: {data.pausedReason}</p>}
        {data && (
          <p>
            {data.sentLast24h} enviados em 24h ·{" "}
            <Link href="/aprovacoes" className="font-medium text-indigo-600 hover:underline">
              {data.pendingApprovals} esperando você
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
