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
