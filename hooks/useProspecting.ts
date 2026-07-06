"use client";

import { useCallback, useState } from "react";
import type { ProspectingJobDTO, ProspectingFilters } from "@/types/prospecting";

type ProspectingSource = NonNullable<ProspectingFilters["sources"]>[number];

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  const startSearch = useCallback(async (filters: ProspectingFilters) => {
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
        };
        error?: string;
      };

      if (!response.ok) throw new Error(data.error ?? "Erro na prospecção");

      if (data.job) setLastJob(data.job);
      await fetchJobs();
      return data.job;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      return null;
    } finally {
      setSearching(false);
    }
  }, [fetchJobs]);

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
