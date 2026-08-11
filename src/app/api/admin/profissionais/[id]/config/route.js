import { NextResponse } from "next/server";
import { exigirPapel } from "@/lib/auth";
import { db } from "@/lib/db";
const UUID = /^[0-9a-f-]{36}$/i;
export async function GET(_req, { params }) {
  if (!await exigirPapel(["admin"])) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ erro: "Profissional inválido." }, { status: 400 });
  const [servicos, horarios] = await Promise.all([db.from("profissional_servicos").select("servico_id").eq("profissional_id", id), db.from("profissional_horarios").select("id,dia_semana,hora_inicio,hora_fim,ativo").eq("profissional_id", id).order("dia_semana")]);
  if (servicos.error || horarios.error) return NextResponse.json({ erro: "Não foi possível carregar a configuração." }, { status: 500 });
  return NextResponse.json({ servicos: servicos.data || [], horarios: horarios.data || [] });
}
export async function PUT(req, { params }) {
  if (!await exigirPapel(["admin"])) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ erro: "Profissional inválido." }, { status: 400 });
  const corpo = await req.json();
  const servicos = [...new Set(Array.isArray(corpo.servicos) ? corpo.servicos : [])];
  const horarios = Array.isArray(corpo.horarios) ? corpo.horarios : [];
  if (servicos.some((x) => !UUID.test(x)) || horarios.some((h) => !Number.isInteger(Number(h.dia_semana)) || Number(h.dia_semana) < 0 || Number(h.dia_semana) > 6 || !/^\d{2}:\d{2}$/.test(h.hora_inicio) || !/^\d{2}:\d{2}$/.test(h.hora_fim) || h.hora_fim <= h.hora_inicio)) return NextResponse.json({ erro: "Serviços ou horários inválidos." }, { status: 400 });
  const perfil = await db.from("usuarios").select("id,papel").eq("id", id).maybeSingle();
  if (!perfil.data || perfil.data.papel !== "colaborador") return NextResponse.json({ erro: "Profissional não encontrado." }, { status: 404 });
  const apagarServicos = await db.from("profissional_servicos").delete().eq("profissional_id", id); if (apagarServicos.error) throw apagarServicos.error;
  if (servicos.length) { const inserir = await db.from("profissional_servicos").insert(servicos.map((servico_id) => ({ profissional_id: id, servico_id }))); if (inserir.error) throw inserir.error; }
  const apagarHorarios = await db.from("profissional_horarios").delete().eq("profissional_id", id); if (apagarHorarios.error) throw apagarHorarios.error;
  if (horarios.length) { const inserir = await db.from("profissional_horarios").insert(horarios.map((h) => ({ profissional_id: id, dia_semana: Number(h.dia_semana), hora_inicio: h.hora_inicio, hora_fim: h.hora_fim, ativo: true }))); if (inserir.error) throw inserir.error; }
  return NextResponse.json({ ok: true });
}
