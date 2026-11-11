// Registro dos coletores ativos. Para adicionar uma fonte:
// 1. gere o cliente com a skill reverse-api-engineer (ver collectors/README.md);
// 2. crie collectors/<fonte>.ts exportando um Collector;
// 3. inclua aqui.
import type { Collector } from "./types";
import { csvInbox } from "./csv-inbox";

export const collectors: Collector[] = [csvInbox];
