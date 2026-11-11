// Registro dos coletores ativos. Para adicionar uma fonte:
// 1. gere o cliente com a skill reverse-api-engineer (ver collectors/README.md);
// 2. crie collectors/<fonte>.ts exportando um Collector;
// 3. inclua aqui.
// Indeed Brasil fica de fora: responde 403 com "Security Check" (Cloudflare) para acesso automatizado.
import type { Collector } from "./types";
import { csvInbox } from "./csv-inbox";
import { infojobs } from "./infojobs";
import { linkedinVagas } from "./linkedin-vagas";

export const collectors: Collector[] = [csvInbox, infojobs, linkedinVagas];
