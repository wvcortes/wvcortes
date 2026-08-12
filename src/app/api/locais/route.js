import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { conflitoDeUnidade } from "@/lib/unidades";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function identidade(req) {
  const usuario = await usuarioAtual();
  if (!usuario || !["admin", "colaborador"].includes(usuario.papel)) return null;
  if (usuario.papel === "colaborador") return usuario.id;
  return new URL(req.url).searchParams.get("profissional") || null;
}

export async function GET(req) {
  const profissionalId = await identidade(req);
  if (!UUID.test(profissionalId || "")) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  const [perfil, excecoes, unidades] = await Promise.all([
    db.from("usuarios").select("id,nome,unidade_id").eq("id", profissionalId).eq("papel", "colaborador").maybeSingle(),
    db.from("profissional_locais_data").select("data,unidade_id,unidades(nome)").eq("profissional_id", profissionalId).gte("data", hoje()).order("data"),
    db.from("unidades").select("id,nome").eq("ativo", true).is("excluido_em", null).order("nome"),
  ]);
  if (perfil.error || excecoes.error || unidades.error) throw perfil.error || excecoes.error || unidades.error;
  return NextResponse.json({ perfil: perfil.data, excecoes: excecoes.data || [], unidades: unidades.data || [] });
}

export async function PUT(req) {
  const usuario = await usuarioAtual();
  if (!usuario || !["admin", "colaborador"].includes(usuario.papel)) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  const corpo = await req.json();
  const profissionalId = usuario.papel === "colaborador" ? usuario.id : String(corpo.profissional_id || "");
  const data = String(corpo.data || ""); const unidadeId = String(corpo.unidade_id || "");
  if (!UUID.test(profissionalId) || !UUID.test(unidadeId) || !DATA.test(data) || data < hoje()) return NextResponse.json({ erro: "Profissional, unidade ou data inválida." }, { status: 400 });
  const conflito = await conflitoDeUnidade(profissionalId, data, unidadeId);
  if (conflito) return NextResponse.json({ erro: "Não é possível mudar o local: existem agendamentos ativos desse profissional em outra unidade nessa data." }, { status: 409 });
  const unidade = await db.from("unidades").select("id").eq("id", unidadeId).eq("ativo", true).is("excluido_em", null).maybeSingle();
  if (unidade.error || !unidade.data) return NextResponse.json({ erro: "Unidade indisponível." }, { status: 400 });
  const salvo = await db.from("profissional_locais_data").upsert({ profissional_id: profissionalId, data, unidade_id: unidadeId }, { onConflict: "profissional_id,data" });
  if (salvo.error) throw salvo.error;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const usuario = await usuarioAtual();
  if (!usuario || !["admin", "colaborador"].includes(usuario.papel)) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  const corpo = await req.json();
  const profissionalId = usuario.papel === "colaborador" ? usuario.id : String(corpo.profissional_id || "");
  const data = String(corpo.data || "");
  if (!UUID.test(profissionalId) || !DATA.test(data) || data < hoje()) return NextResponse.json({ erro: "Exceção inválida." }, { status: 400 });
  const perfil = await db.from("usuarios").select("unidade_id").eq("id", profissionalId).maybeSingle();
  if (perfil.error || !perfil.data?.unidade_id) return NextResponse.json({ erro: "Defina uma unidade padrão antes de remover a exceção." }, { status: 409 });
  if (await conflitoDeUnidade(profissionalId, data, perfil.data.unidade_id)) return NextResponse.json({ erro: "Não é possível remover: existem agendamentos ativos em outra unidade nessa data." }, { status: 409 });
  const removido = await db.from("profissional_locais_data").delete().eq("profissional_id", profissionalId).eq("data", data);
  if (removido.error) throw removido.error;
  return NextResponse.json({ ok: true });
}
