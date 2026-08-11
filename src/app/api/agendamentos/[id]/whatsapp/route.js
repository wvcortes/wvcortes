import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataCurta, hora } from "@/lib/formato";
const UUID = /^[0-9a-f-]{36}$/i;
export async function GET(_req, { params }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ erro: "Agendamento inválido." }, { status: 400 });
  const { data: agendamento, error } = await db.from("agendamentos").select("id,nome_cliente,inicio,observacoes,profissional_id,servico_id,unidade_id").eq("id", id).maybeSingle();
  if (error || !agendamento) return NextResponse.json({ erro: "Agendamento não encontrado." }, { status: 404 });
  const [profissional, servico, unidade] = await Promise.all([
    db.from("usuarios").select("whatsapp_pessoal").eq("id", agendamento.profissional_id).maybeSingle(),
    db.from("servicos").select("nome").eq("id", agendamento.servico_id).maybeSingle(),
    db.from("unidades").select("nome").eq("id", agendamento.unidade_id).maybeSingle(),
  ]);
  const telefone = String(profissional.data?.whatsapp_pessoal || "").replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(telefone)) return NextResponse.json({ erro: "WhatsApp do profissional indisponível." }, { status: 409 });
  const mensagem = [`Olá! Meu agendamento na WV Cortes foi confirmado.`, `Cliente: ${agendamento.nome_cliente}`, `Serviço: ${servico.data?.nome || ""}`, `Data: ${dataCurta(agendamento.inicio)}`, `Horário: ${hora(agendamento.inicio)}`, `Unidade: ${unidade.data?.nome || ""}`, agendamento.observacoes ? `Observações: ${agendamento.observacoes}` : ""].filter(Boolean).join("\n");
  return NextResponse.redirect(`https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`);
}
