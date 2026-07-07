"use client";

import { useCallback, useState } from "react";
import type { ProspectingJobDTO, ProspectingFilters } from "@/types/prospecting";

type ProspectingSource = NonNullable<ProspectingFilters["sources"]>[number];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useProspecting() {
  const [jobs, setJobs] = useState<ProspectingJobDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastJob, setLastJob] = useState<{
    _id: string;
    status: string;
    leadsFound: number;
    ingestion?: { created: number; updated: number; errors: number };
    warnings?: string[];
  } | null>(null);

  const fetchJobs = useCallback(async (source?: ProspectingSource) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      const response = await fetch(
        `/api/prospecting/jobs${params.toString() ? `?${params.toString()}` : ""}`,
      );
      const data = (await response.json()) as {
        jobs: ProspectingJobDTO[];
        error?: string;
      };

      if (!response.ok) throw new Error(data.error ?? "Erro ao carregar jobs");
      setJobs(data.jobs);
      return data.jobs;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const waitForJobCompletion = useCallback(
    async (jobId: string, source?: ProspectingSource) => {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await sleep(3000);
        const jobsList = await fetchJobs(source);
        const job = jobsList.find((item) => item._id === jobId);

        if (!job) continue;

        if (job.status === "COMPLETED" || job.status === "FAILED") {
          setLastJob({
            _id: job._id,
            status: job.status,
            leadsFound: job.leadsFound,
          });
          return job;
        }
      }

      throw new Error(
        "A busca ainda está em andamento no PNCP. Aguarde e atualize a lista em alguns minutos.",
      );
    },
    [fetchJobs],
  );

  const startSearch = useCallback(
    async (filters: ProspectingFilters) => {
      setSearching(true);
      setError(null);

      try {
        const response = await fetch("/api/prospecting/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(filters),
        });

        const data = (await response.json()) as {
          job?: {
            _id: string;
            status: string;
            leadsFound: number;
            ingestion?: { created: number; updated: number; errors: number };
            warnings?: string[];
          };
          error?: string;
        };

        if (!response.ok) throw new Error(data.error ?? "Erro na prospecção");

        if (data.job?.warnings?.length) {
          setError(data.job.warnings.join(" "));
        }

        if (data.job) {
          setLastJob(data.job);

          if (data.job.status === "RUNNING") {
            const source = filters.sources?.[0];
            const completedJob = await waitForJobCompletion(data.job._id, source);
            return {
              _id: completedJob._id,
              status: completedJob.status,
              leadsFound: completedJob.leadsFound,
              warnings: data.job.warnings,
            };
          }
        }

        await fetchJobs(filters.sources?.[0]);
        return data.job ?? null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
        return null;
      } finally {
        setSearching(false);
      }
    },
    [fetchJobs, waitForJobCompletion],
  );

  return {
    jobs,
    loading,
    searching,
    error,
    lastJob,
    fetchJobs,
    startSearch,
  };
}
