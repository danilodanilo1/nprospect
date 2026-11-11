# Nprospect: vendas do nRecruit

Sistema local de prospecção e venda do nRecruit. Um botão Liga/Desliga, funil de 10 estágios,
humano pode assumir qualquer lead, e todo envio e resposta fica no log.
Arquitetura: [doc no Claude](https://claude.ai/artifact/21DPb7vFTSH9g9PqhQGqJs).

## Rodar na sua máquina

```bash
npm install
cp .env.example .env.local   # preencha MONGODB_URI, ADMIN_*, SMTP_* e pelo menos uma IA
npm run build && npm run start   # painel em http://localhost:3000/funil
npm run worker                   # em outro terminal: o worker que executa os agentes
```

MongoDB: Atlas M0 (grátis) ou local (`docker run -d -p 27017:27017 mongo:7`).
IA: Ollama local (`ollama pull qwen2.5:7b`) e/ou chaves grátis de Gemini, Groq ou OpenRouter.
Sem IA nenhuma o sistema usa textos fixos; sem SMTP ele só qualifica e redige.

## Como funciona

| Peça | Onde |
| --- | --- |
| Liga/Desliga, status do worker | barra lateral (`components/funnel/system-toggle.tsx`) |
| Funil com Assumir / Devolver / Pausar / Remover | `/funil` |
| Histórico de um lead + escrever você mesmo | `/funil/[id]` |
| Log de todas as interações | `/conversas` |
| Rascunhos esperando você | `/aprovacoes` |
| Agentes (Caçador, Qualificador, Redator, Disparador, Leitor, Closer) | `worker/pipeline.ts` |
| Guarda (limite diário, dias e horário, bounce, bloqueio) | `lib/guard.ts` |
| Coletores de leads (engenharia reversa) | `collectors/` (ver `collectors/README.md`) |
| Prompts versionados | `prompts/index.ts` |

Regras que o código garante:

- Desligado, nada sai. O worker relê o botão antes de cada envio.
- Lead assumido por humano: a IA cancela os rascunhos dela e não age mais nele.
- Todo estágio começa em "Aprovar antes". Mude em Funil → Modo de cada estágio.
- Máximo de 20 primeiros contatos por dia, ter a qui, 9h às 11h (configurável). Respostas a quem escreveu saem a qualquer hora.
- Bounce acima de 3% em 7 dias ou 2 pedidos de remoção em 24h desligam o sistema sozinho.
- Quem pede para sair entra na lista de bloqueio e nunca volta, nem se for importado de novo.
- Follow-ups saem na mesma conversa (In-Reply-To/References).
- Nenhum coletor usa login de conta pessoal.

## Testes

```bash
npm test   # unitários + funil de ponta a ponta (precisa de MongoDB em TEST_MONGODB_URI ou localhost:27017)
```

---

# Legado: Pospect (construção)

# Pospect

CRM B2B de prospecção inteligente para lojas de materiais de construção. Integra **PNCP**, **Google Places**, **IA** e automação **n8n** com deduplicação multi-fonte e scoring automático.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS** + componentes UI responsivos
- **MongoDB Atlas** + Mongoose
- **NextAuth.js v5** (JWT)
- **Recharts** (analytics)
- Deploy: **Vercel** (serverless)

## Setup local

### 1. Clonar e instalar

```bash
npm install
cp .env.example .env.local
```

### 2. Configurar variáveis

Edite `.env.local` com:

| Variável | Descrição |
|----------|-----------|
| `MONGODB_URI` | Connection string do MongoDB Atlas |
| `NEXTAUTH_SECRET` | Secret para JWT (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciais do primeiro admin |
| `N8N_WEBHOOK_URL` | URL do workflow n8n |
| `N8N_WEBHOOK_SECRET` | Secret compartilhado com n8n |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Places API |
| `OPENAI_API_KEY` ou `GEMINI_API_KEY` | Enriquecimento IA |

### 3. MongoDB Atlas

1. Crie cluster free tier em [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Adicione IP `0.0.0.0/0` (dev) ou IP da Vercel (prod)
3. Copie a connection string para `MONGODB_URI`

### 4. Executar

```bash
npm run dev
```

Acesse `http://localhost:3000` e faça login com `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Deploy Vercel

1. Importe o repositório na Vercel
2. Configure todas as variáveis de `.env.example`
3. Deploy automático a cada push

## Estrutura de rotas

| Rota | Descrição |
|------|-----------|
| `/` | Landing page (SSR) |
| `/login` | Autenticação |
| `/dashboard` | KPIs e pipeline |
| `/leads` | Lista de leads |
| `/leads/[id]` | Detalhe + IA |
| `/prospecting` | Busca PNCP/Google |
| `/settings` | Configurações |

## API

### Dashboard (autenticado)

- `GET/POST /api/leads` — CRUD leads
- `GET/PATCH/DELETE /api/leads/[id]`
- `POST /api/leads/[id]/enrich` — enriquecimento IA
- `POST /api/prospecting/search` — dispara busca
- `GET /api/prospecting/jobs` — histórico
- `GET /api/dashboard/stats` — métricas

### Webhooks (n8n)

Header obrigatório: `X-Webhook-Secret: {N8N_WEBHOOK_SECRET}`

#### POST `/api/webhooks/leads-ingestion`

```json
{
  "jobId": "optional-mongo-id",
  "leads": [
    {
      "name": "Construtora ABC Ltda",
      "cnpj": "12345678000199",
      "source": "PNCP_BID",
      "contacts": {
        "phone": "11999999999",
        "email": "contato@abc.com.br",
        "address": "São Paulo - SP"
      },
      "placeId": "ChIJ...",
      "metadata": {
        "pncp": {
          "bidId": "PNCP-123",
          "value": 250000,
          "object": "Fornecimento de materiais de construção"
        },
        "google": {
          "rating": 4.5,
          "reviews": 32
        }
      }
    }
  ]
}
```

Resposta:

```json
{
  "success": true,
  "created": 1,
  "updated": 0,
  "errors": 0
}
```

#### POST `/api/webhooks/scraper-results`

```json
{
  "jobId": "optional-mongo-id",
  "url": "https://construtora.com.br",
  "data": {
    "name": "Construtora XYZ",
    "cnpj": "98765432000188",
    "phone": "11888888888",
    "email": "vendas@xyz.com.br"
  },
  "lead": {
    "name": "Construtora XYZ",
    "source": "SCRAPER",
    "cnpj": "98765432000188"
  }
}
```

## Deduplicação

Prioridade de match na ingestão:

1. CNPJ normalizado
2. `placeId` (Google Places)
3. Nome + telefone (fallback)

Leads existentes são **atualizados** (merge de metadata, append de sources, recálculo de score).

## Scoring

| Sinal | Pontos |
|-------|--------|
| Google rating ≥ 4 | +15 |
| Licitação PNCP > R$ 100k | +25 |
| CNPJ válido | +10 |
| Contatos completos | +10 |
| Múltiplas fontes | +20 |
| Licitação PNCP confirmada | +10 |

## Integração n8n

Fluxo recomendado:

1. App dispara `POST N8N_WEBHOOK_URL` com `{ jobId, filters, callbackUrl }`
2. n8n executa PNCP + Google Places + Puppeteer em paralelo
3. n8n envia resultados para `/api/webhooks/leads-ingestion` ou `/api/webhooks/scraper-results`

Configure Cloudflare Tunnel para expor n8n localmente em produção.

## Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # build produção
npm run start    # servidor produção
npm run lint     # ESLint
```

## Licença

Projeto privado — Pospect CRM.
