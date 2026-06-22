import Link from "next/link";
import {
  Building2,
  MapPin,
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Building2,
    title: "Licitações PNCP",
    description:
      "Monitore contratos públicos de obras e materiais de construção em tempo real.",
  },
  {
    icon: MapPin,
    title: "Google Places",
    description:
      "Encontre construtoras e empresas da região com cache inteligente de place_id.",
  },
  {
    icon: Sparkles,
    title: "Enriquecimento com IA",
    description:
      "Qualifique leads automaticamente e gere pitches comerciais personalizados.",
  },
  {
    icon: TrendingUp,
    title: "Score inteligente",
    description:
      "Priorize oportunidades com scoring baseado em múltiplas fontes de dados.",
  },
  {
    icon: Shield,
    title: "Deduplicação automática",
    description:
      "Unifique dados de PNCP, Google e scraper sem registros duplicados.",
  },
  {
    icon: Zap,
    title: "Automação n8n",
    description:
      "Dispare scraping e workflows externos sem bloquear sua operação comercial.",
  },
];

export default function LandingPage() {
  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              CRM B2B para materiais de construção
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              Prospecção inteligente que transforma dados em vendas
            </h1>
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">
              O Pospect integra PNCP, Google Places e automação n8n para sua loja
              encontrar construtoras, qualificar leads e fechar mais negócios.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  Começar agora
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Ver dashboard
                </Button>
              </Link>
            </div>
          </div>

          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900 dark:from-amber-950/30 dark:to-slate-950">
            <CardHeader>
              <CardTitle>Pipeline em tempo real</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Novos leads hoje", value: "24", color: "bg-blue-500" },
                { label: "Score médio", value: "67", color: "bg-amber-500" },
                { label: "Licitações PNCP", value: "12", color: "bg-green-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {item.label}
                  </span>
                  <span className="flex items-center gap-2 font-semibold">
                    <span className={`h-2 w-2 rounded-full ${item.color}`} />
                    {item.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-slate-50 py-16 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            Tudo que sua equipe comercial precisa
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600 dark:text-slate-400">
            Multi-fonte, deduplicação automática e IA integrada — projetado para
            lojas de materiais de construção que querem vender mais para o B2B.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title}>
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
          Pronto para prospectar smarter?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
          Configure em minutos com MongoDB Atlas, Vercel e n8n. Custo zero para
          começar.
        </p>
        <Link href="/login" className="mt-8 inline-block">
          <Button size="lg">Acessar o Pospect</Button>
        </Link>
      </section>
    </main>
  );
}
