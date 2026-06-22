"use client";

import { useSession } from "next-auth/react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div>
      <DashboardHeader title="Configurações" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-slate-500">Nome:</span>{" "}
              {session?.user?.name ?? "—"}
            </p>
            <p>
              <span className="text-slate-500">Email:</span>{" "}
              {session?.user?.email ?? "—"}
            </p>
            <p>
              <span className="text-slate-500">Função:</span>{" "}
              {session?.user?.role ?? "seller"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Configure as variáveis de ambiente no Vercel ou arquivo{" "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                .env.local
              </code>
              :
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>MONGODB_URI — MongoDB Atlas</li>
              <li>N8N_WEBHOOK_URL — automação externa</li>
              <li>GOOGLE_PLACES_API_KEY — busca de empresas</li>
              <li>OPENAI_API_KEY ou GEMINI_API_KEY — enriquecimento IA</li>
              <li>DEFAULT_SEARCH_REGION — região padrão da loja</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
