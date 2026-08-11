import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CAMPOS = [
  "nome", "slogan", "sobre", "telefone", "whatsapp", "email", "endereco",
  "instagram", "hora_abertura", "hora_fechamento", "dias_funcionamento", "intervalo_min",
];

export async function PUT(req) {
  const admin = await exigirPapel(["admin"]);
  if (!admin) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });

  const corpo = await req.json();
  const dados = {};
  for (const c of CAMPOS) if (c in corpo) dados[c] = corpo[c];
  if (dados.intervalo_min) dados.intervalo_min = parseInt(dados.intervalo_min, 10);

  const { error } = await db.from("barbearia").update(dados).eq("id", 1);
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
