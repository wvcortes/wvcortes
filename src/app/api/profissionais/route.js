import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolverUnidadeEfetiva } from "@/lib/unidades";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const unidade = p.get("unidade") || "";
  const servico = p.get("servico") || "";
  const data = p.get("data") || "";
  if (!UUID.test(unidade) || !UUID.test(servico) || !DATA.test(data)) {
    return NextResponse.json({ erro: "Unidade, serviço ou data inválida." }, { status: 400 });
  }
  const dia = new Date(`${data}T12:00:00Z`).getUTCDay();
  const [perfis, vinculos, jornadas] = await Promise.all([
    db.from("usuarios").select("id,nome,especialidade,unidade_id").eq("papel", "colaborador").eq("ativo", true),
    db.from("profissional_servicos").select("profissional_id").eq("servico_id", servico),
    db.from("profissional_horarios").select("profissional_id").eq("dia_semana", dia).eq("ativo", true),
  ]);
  if (perfis.error || vinculos.error || jornadas.error) throw perfis.error || vinculos.error || jornadas.error;
  const habilitados = new Set((vinculos.data || []).map((x) => x.profissional_id));
  const comJornada = new Set((jornadas.data || []).map((x) => x.profissional_id));
  const candidatos = (perfis.data || []).filter((x) => habilitados.has(x.id) && comJornada.has(x.id));
  const efetivas = await Promise.all(candidatos.map(async (x) => ({ ...x, unidade_efetiva_id: await resolverUnidadeEfetiva(x.id, data, x.unidade_id) })));
  return NextResponse.json({ profissionais: efetivas.filter((x) => x.unidade_efetiva_id === unidade) }, { headers: { "Cache-Control": "no-store" } });
}
