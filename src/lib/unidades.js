import "server-only";

import { db } from "./db";
import { limitesDoDia } from "./formato";

export async function resolverUnidadeEfetiva(profissionalId, data, unidadePadrao = undefined) {
  const excecao = await db
    .from("profissional_locais_data")
    .select("unidade_id")
    .eq("profissional_id", profissionalId)
    .eq("data", data)
    .maybeSingle();

  if (excecao.error) throw excecao.error;
  if (excecao.data) return excecao.data.unidade_id;
  if (unidadePadrao !== undefined) return unidadePadrao;

  const perfil = await db.from("usuarios").select("unidade_id").eq("id", profissionalId).maybeSingle();
  if (perfil.error) throw perfil.error;
  return perfil.data?.unidade_id || null;
}

export async function conflitoDeUnidade(profissionalId, data, unidadeId) {
  const { de, ate } = limitesDoDia(data);
  const consulta = await db
    .from("agendamentos")
    .select("id,unidade_id")
    .eq("profissional_id", profissionalId)
    .neq("status", "cancelado")
    .gte("inicio", de)
    .lte("inicio", ate)
    .neq("unidade_id", unidadeId)
    .limit(1);
  if (consulta.error) throw consulta.error;
  return consulta.data?.[0] || null;
}
