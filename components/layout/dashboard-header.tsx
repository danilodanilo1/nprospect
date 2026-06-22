"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardHeader({ title }: { title: string }) {
  const { data: session } = useSession();

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>
        {session?.user?.email && (
          <p className="text-sm text-slate-500">{session.user.email}</p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
        <LogOut className="h-4 w-4" />
        Sair
      </Button>
    </header>
  );
}
