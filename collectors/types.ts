// Contrato de um coletor (agente Caçador). Cada fonte vira um arquivo em collectors/
// que devolve leads COM sinal de intenção. Lead sem sinal é descartado pelo Qualificador.
import type { ProspectInput } from "@/lib/csv";

export interface CollectorContext {
  now: Date;
  /** espera entre requisições ao mesmo site; respeite sempre */
  sleep: (ms: number) => Promise<void>;
  log: (msg: string) => void;
}

export interface Collector {
  /** identificador curto, vira o campo `source` do lead */
  name: string;
  /** de quantas em quantas horas pode rodar */
  everyHours: number;
  /** precisa de login? Coletores com login são proibidos neste projeto. */
  requiresLogin: false;
  run: (ctx: CollectorContext) => Promise<ProspectInput[]>;
}

/** Erro que pausa o coletor até a próxima janela (429, captcha, bloqueio). */
export class CollectorBlocked extends Error {}
