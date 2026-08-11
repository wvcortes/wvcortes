import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CAMPOS = [
  "nome", "slogan", "sobre", "telefone", "whatsapp", "email", "endereco",
  "instagram", "hora_abertura", "hora_fechamento", "dias_funcionamento", "intervalo_min",
  "pix_chave", "pix_nome_recebedor", "pix_cidade", "biografia_wenderson",
];

export async function PUT(req) {
  const admin = await exigirPapel(["admin"]);
  if (!admin) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });

  const corpo = await req.json();
  const dados = {};
  for (const c of CAMPOS) if (c in corpo) dados[c] = String(corpo[c] ?? "").trim().slice(0, c === "biografia_wenderson" || c === "sobre" ? 4000 : 255);
  if ("intervalo_min" in dados) {
    dados.intervalo_min = Number.parseInt(dados.intervalo_min, 10);
    if (!Number.isInteger(dados.intervalo_min) || dados.intervalo_min < 5 || dados.intervalo_min > 240) return NextResponse.json({ erro: "Intervalo inválido." }, { status: 400 });
  }
  if ("whatsapp" in dados && dados.whatsapp && !/^\d{10,15}$/.test(dados.whatsapp.replace(/\D/g, ""))) return NextResponse.json({ erro: "Informe o WhatsApp com DDI e somente números." }, { status: 400 });
  if ("whatsapp" in dados) dados.whatsapp = dados.whatsapp.replace(/\D/g, "");

  const { error } = await db.from("barbearia").update(dados).eq("id", 1);
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
