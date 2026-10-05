"use client";

import Link from "next/link";
import { Building2, Trophy } from "lucide-react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const options = [
  {
    href: "/prospecting/companies",
    title: "Prospecção Empresas",
    description:
      "Encontrar construtoras, empreiteiras, engenharias e outros negócios no Google Places.",
    icon: Building2,
  },
  {
    href: "/prospecting/bids",
    title: "Prospecção Licitações",
    description:
      "Encontrar empresas que venceram contratos públicos relacionados a obras e materiais.",
    icon: Trophy,
  },
];

export default function ProspectingPage() {
  return (
    <div>
      <DashboardHeader title="Prospecção" />
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        Escolha o motor de busca. Os resultados encontrados são salvos em Leads
        para acompanhamento comercial.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {options.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition hover:border-amber-300 hover:shadow-md dark:hover:border-amber-800">
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
