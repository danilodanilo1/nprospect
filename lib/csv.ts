// CSV simples (RFC 4180): aspas, vírgula ou ponto e vírgula, quebra de linha dentro de aspas.
import { SIGNALS, type ProspectSignal, type Signal } from "@/lib/funnel";

export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((h) => normalizeKey(h));
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export function normalizeKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export interface ProspectInput {
  company: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  city?: string;
  cnpj?: string;
  teamSize?: number;
  signals: ProspectSignal[];
}

const pick = (r: Record<string, string>, ...keys: string[]) =>
  keys.map((k) => r[k]).find((v) => v !== undefined && v !== "") || undefined;

/**
 * Colunas aceitas (qualquer ordem, acentos ignorados): empresa, nome/contato, email, telefone,
 * site, instagram, linkedin, cidade, cnpj, pessoas, sinal, evidencia, url_evidencia, data_sinal.
 * "sinal" aceita vários separados por "|" (ex.: SEM_ATS|VOLUME_ALTO).
 */
export function rowToProspect(r: Record<string, string>, now = new Date()): ProspectInput | null {
  const company = pick(r, "empresa", "company", "consultoria", "nome_empresa");
  if (!company) return null;
  const signalTypes = (pick(r, "sinal", "sinais", "signal") ?? "")
    .split("|")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is Signal => (SIGNALS as readonly string[]).includes(s));
  const seenRaw = pick(r, "data_sinal", "seen_at");
  const seenAt = seenRaw && !Number.isNaN(Date.parse(seenRaw)) ? new Date(seenRaw) : now;
  const team = pick(r, "pessoas", "team_size", "tamanho");
  return {
    company,
    contactName: pick(r, "nome", "contato", "contact_name", "responsavel"),
    email: pick(r, "email", "e_mail")?.toLowerCase(),
    phone: pick(r, "telefone", "whatsapp", "phone"),
    website: pick(r, "site", "website"),
    instagram: pick(r, "instagram"),
    linkedin: pick(r, "linkedin"),
    city: pick(r, "cidade", "city"),
    cnpj: pick(r, "cnpj")?.replace(/\D/g, ""),
    teamSize: team && !Number.isNaN(Number(team)) ? Number(team) : undefined,
    signals: signalTypes.map((type) => ({
      type,
      seenAt,
      evidenceText: pick(r, "evidencia", "evidence"),
      evidenceUrl: pick(r, "url_evidencia", "evidence_url"),
    })),
  };
}
