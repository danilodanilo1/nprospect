import { Badge } from "@/components/ui/badge";
import { SIGNAL_LABELS, type Signal } from "@/lib/funnel";

export function OwnerBadge({ owner, paused }: { owner: "IA" | "HUMANO"; paused?: boolean }) {
  if (paused) return <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Pausado</Badge>;
  return owner === "HUMANO" ? (
    <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">Humano</Badge>
  ) : (
    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">IA</Badge>
  );
}

export function SignalBadge({ type }: { type: Signal }) {
  return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">{SIGNAL_LABELS[type] ?? type}</Badge>;
}

const AUTHOR_STYLE: Record<string, string> = {
  IA: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  HUMANO: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  LEAD: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  SISTEMA: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function AuthorBadge({ author }: { author: string }) {
  return <Badge className={AUTHOR_STYLE[author] ?? AUTHOR_STYLE.SISTEMA}>{author === "LEAD" ? "Lead" : author === "HUMANO" ? "Humano" : author === "IA" ? "IA" : "Sistema"}</Badge>;
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Esperando aprovação",
  AGENDADA: "Na fila",
  ENVIADA: "Enviada",
  RECEBIDA: "Recebida",
  REJEITADA: "Cancelada",
  BLOQUEADA: "Bloqueada pelo Guarda",
  ERRO: "Erro",
  REGISTRO: "Registro",
};

export function StatusText({ status }: { status: string }) {
  return <span className="text-xs text-slate-500">{STATUS_LABEL[status] ?? status}</span>;
}
