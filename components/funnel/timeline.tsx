"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthorBadge, StatusText } from "./badges";
import type { InteractionDTO } from "./types";

function when(d?: string) {
  return d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
}

/** Uma linha do log: quem fez, o quê, por quê e (para a IA) o prompt usado. */
export function TimelineItem({ i, showLead = false }: { i: InteractionDTO; showLead?: boolean }) {
  const [open, setOpen] = useState(false);
  const lead = typeof i.prospect === "object" ? i.prospect : null;
  const isEvent = i.direction === "INTERNAL";
  return (
    <div className={isEvent ? "border-l-2 border-slate-200 py-1 pl-3 dark:border-slate-700" : "rounded-lg border border-slate-200 p-3 dark:border-slate-800"}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <AuthorBadge author={i.author} />
        {showLead && lead && (
          <Link href={`/funil/${lead._id}`} className="font-medium text-slate-800 hover:underline dark:text-slate-100">
            {lead.company}
          </Link>
        )}
        <span>{i.direction === "OUT" ? "→ enviou" : i.direction === "IN" ? "← recebeu" : ""}</span>
        <span>{i.channel !== "SISTEMA" ? i.channel : ""}</span>
        <span>{i.kind}</span>
        {i.replyClass && <span className="font-medium text-sky-700 dark:text-sky-300">{i.replyClass}</span>}
        <StatusText status={i.status} />
        <span className="ml-auto">{when(i.sentAt ?? i.createdAt)}</span>
      </div>
      {i.subject && !isEvent && <p className="mt-1 text-sm font-medium">{i.subject}</p>}
      <p className={isEvent ? "text-sm text-slate-600 dark:text-slate-300" : "mt-1 whitespace-pre-wrap text-sm"}>{i.body}</p>
      {i.reason && !isEvent && <p className="mt-1 text-xs text-slate-500">Motivo: {i.reason}</p>}
      {i.error && <p className="mt-1 text-xs text-red-600">{i.error}</p>}
      {i.prompt && (
        <button onClick={() => setOpen((v) => !v)} className="mt-1 text-xs text-indigo-600 hover:underline">
          {open ? "esconder prompt" : `ver prompt${i.aiModel ? ` (${i.aiModel})` : ""}`}
        </button>
      )}
      {open && <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs dark:bg-slate-900">{i.prompt}</pre>}
    </div>
  );
}
