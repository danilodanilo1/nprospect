# Coletores (agente Caçador)

Cada coletor busca **uma** fonte pública e devolve leads com sinal de intenção
(`SEM_ATS`, `VOLUME_ALTO`, `EMPRESA_NOVA`, `CONTRATANDO_RECRUTADOR`, `INSATISFEITO_CONCORRENTE`).
O worker roda cada coletor no intervalo `everyHours`, só com o sistema ligado.

## Regras (não negociáveis)

- **Sem login.** Nenhum coletor usa cookie, senha ou sessão de conta pessoal. LinkedIn: só a busca pública de vagas.
- 1 requisição a cada 5 a 10 s por site, cache de 24 h.
- Recebeu 429, captcha ou página de bloqueio: lance `CollectorBlocked`. O coletor para até a próxima janela.
- Guarde em `evidenceText`/`evidenceUrl` a prova do sinal (título e link da vaga). O Redator cita isso no e-mail.

## Gerar um coletor com a skill reverse-api-engineer

No Claude Code do PC (não roda na nuvem, precisa de navegador):

1. `/reverse-api-engineer` e peça: "capture a API de busca de vagas de <site> para a consulta 'consultoria recrutamento' em São Paulo, sem login".
2. A skill grava o tráfego (HAR) e gera um cliente Python ou TypeScript.
3. Peça para transformar o cliente em `collectors/<site>.ts` seguindo `collectors/types.ts`, mapeando cada vaga para `ProspectInput` com o sinal certo.
4. Registre em `collectors/index.ts` e rode `npm run collect -- <nome>` para testar sem mexer no funil (`--dry`).

Atalho: qualquer script pode só gravar um CSV em `data/inbox/`. O coletor `csv-inbox` importa sozinho.
Colunas: `empresa, nome, email, telefone, site, instagram, linkedin, cidade, cnpj, pessoas, sinal, evidencia, url_evidencia, data_sinal`.
