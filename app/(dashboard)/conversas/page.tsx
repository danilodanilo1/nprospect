"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { TimelineItem } from "@/components/funnel/timeline";
import type { InteractionDTO } from "@/components/funnel/types";
import { useJson } from "@/hooks/useJson";

export default function ConversasPage() {
  const [onlyMessages, setOnlyMessages] = useState(true);
  const { data, error } = useJson<InteractionDTO[]>("/api/interactions?limit=300", 15000);
  const items = (data ?? []).filter((i) => !onlyMessages || i.direction !== "INTERNAL");

  return (
    <div>
      <DashboardHeader title="Conversas e log" />
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={onlyMessages} onChange={(e) => setOnlyMessages(e.target.checked)} />
        Só mensagens (esconder mudanças de estágio e ações)
      </label>
      {error && <p className="text-red-600">{error}</p>}
      <div className="space-y-2">
        {items.map((i) => (
          <TimelineItem key={i._id} i={i} showLead />
        ))}
        {data && items.length === 0 && <p className="text-sm text-slate-500">Nada ainda. Ligue o sistema e importe leads no Funil.</p>}
      </div>
    </div>
  );
}
