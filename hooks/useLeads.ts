"use client";

import { useCallback, useRef, useState } from "react";
import type { LeadDTO, LeadStatus } from "@/types/lead";

interface LeadsResponse {
  leads: LeadDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface UseLeadsFilters {
  status?: LeadStatus;
  source?: string;
  minScore?: number;
  search?: string;
  page?: number;
}

export function useLeads(initialFilters: UseLeadsFilters = {}) {
  const [leads, setLeads] = useState<LeadDTO[]>([]);
  const [pagination, setPagination] = useState<LeadsResponse["pagination"]>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const filtersRef = useRef(initialFilters);

  const fetchLeads = useCallback(async (override?: UseLeadsFilters) => {
    setLoading(true);
    setError(null);

    const current = { ...filtersRef.current, ...override };
    filtersRef.current = current;

    const params = new URLSearchParams();

    if (current.status) params.set("status", current.status);
    if (current.source) params.set("source", current.source);
    if (current.minScore) params.set("minScore", String(current.minScore));
    if (current.search) params.set("search", current.search);
    params.set("page", String(current.page ?? 1));

    try {
      const response = await fetch(`/api/leads?${params.toString()}`);
      const data = (await response.json()) as LeadsResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao carregar leads");
      }

      setLeads(data.leads);
      setPagination(data.pagination);
      setFilters(current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateLead = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      const response = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const updated = (await response.json()) as LeadDTO & { error?: string };
      if (!response.ok) throw new Error(updated.error ?? "Erro ao atualizar");

      setLeads((prev) => prev.map((lead) => (lead._id === id ? updated : lead)));
      return updated;
    },
    [],
  );

  const createLead = useCallback(async (data: Record<string, unknown>) => {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const created = (await response.json()) as LeadDTO & { error?: string };
    if (!response.ok) throw new Error(created.error ?? "Erro ao criar lead");

    setLeads((prev) => [created, ...prev]);
    return created;
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    const response = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Erro ao excluir");
    }
    setLeads((prev) => prev.filter((lead) => lead._id !== id));
  }, []);

  return {
    leads,
    pagination,
    loading,
    error,
    filters,
    fetchLeads,
    updateLead,
    createLead,
    deleteLead,
    setFilters,
  };
}
