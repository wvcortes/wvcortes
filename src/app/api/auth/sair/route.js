import { NextResponse } from "next/server";
import { encerrarSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/sair
 *
 * Encerra a sessão atual removendo
 * o cookie de autenticação.
 */
export async function POST() {
  try {
    encerrarSessao();

    return NextResponse.json(
      {
        ok: true,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e) {
    console.error(
      "[auth/sair]",
      e
    );

    return NextResponse.json(
      {
        erro:
          "Não foi possível encerrar a sessão.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}