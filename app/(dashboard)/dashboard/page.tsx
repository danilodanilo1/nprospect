"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Users, TrendingUp, Sparkles, Search } from "lucide-react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/types/lead";

interface DashboardStats {
  kpis: {
    totalLeads: number;
    newLeads: number;
    avgScore: number;
    jobsCompleted: number;
  };
  pipeline: Array<{ status: string; count: number }>;
  recentJobs: Array<{
    _id: string;
    status: string;
    leadsFound: number;
    createdAt: string;
  }>;
}

const kpiIcons = [Users, Sparkles, TrendingUp, Search];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data: DashboardStats) => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  const kpiData = stats
    ? [
        { label: "Total de Leads", value: stats.kpis.totalLeads },
        { label: "Novos Leads", value: stats.kpis.newLeads },
        { label: "Score Médio", value: stats.kpis.avgScore },
        { label: "Jobs Concluídos", value: stats.kpis.jobsCompleted },
      ]
    : [];

  const chartData =
    stats?.pipeline.map((item) => ({
      status:
        LEAD_STATUS_LABELS[item.status as LeadStatus] ?? item.status,
      count: item.count,
    })) ?? [];

  return (
    <div>
      <DashboardHeader title="Overview" />

      {loading ? (
        <p className="text-slate-500">Carregando métricas...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiData.map((kpi, index) => {
              const Icon = kpiIcons[index];
              return (
                <Card key={kpi.label}>
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{kpi.label}</p>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline por Status</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#d97706" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-500">
                    Nenhum lead no pipeline ainda. Inicie uma prospecção.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Últimas Buscas</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.recentJobs.length ? (
                  <ul className="space-y-3">
                    {stats.recentJobs.map((job) => (
                      <li
                        key={job._id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                      >
                        <div>
                          <p className="text-sm font-medium">{job.status}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(job.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          {job.leadsFound} leads
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Nenhuma busca realizada.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
