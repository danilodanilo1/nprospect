import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";

type Handler<C> = (req: Request, ctx: C, user: string) => Promise<Response>;

/** Rotas do funil: exige login, conecta no banco e devolve erro em JSON. */
export function withAuth<C>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const session = await auth();
      if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      await connectDB();
      return await handler(req, ctx, session.user.email ?? "humano");
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
    }
  };
}
