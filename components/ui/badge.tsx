import { cn } from "@/lib/utils";
import type { LeadStatus, OpportunityTemperature } from "@/types/lead";
import { LEAD_STATUS_LABELS } from "@/types/lead";

const statusStyles: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  CONTACTED: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  QUALIFIED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  PROPOSAL: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  WON: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  LOST: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge className={statusStyles[status]}>{LEAD_STATUS_LABELS[status]}</Badge>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
      : score >= 40
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  return <Badge className={color}>Score {score}</Badge>;
}

const temperatureLabels: Record<OpportunityTemperature, string> = {
  HOT: "Quente",
  WARM: "Médio",
  COLD: "Frio",
  DISCARDED: "Descartado",
};

const temperatureStyles: Record<OpportunityTemperature, string> = {
  HOT: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  WARM: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  COLD: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  DISCARDED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function TemperatureBadge({
  temperature,
}: {
  temperature?: OpportunityTemperature;
}) {
  if (!temperature) {
    return <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Sem score</Badge>;
  }

  return (
    <Badge className={temperatureStyles[temperature]}>
      {temperatureLabels[temperature]}
    </Badge>
  );
}
