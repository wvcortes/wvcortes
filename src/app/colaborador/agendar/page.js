import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";
import FormAgendar from "@/app/agendar/FormAgendar";
export const dynamic = "force-dynamic";
export default async function AgendamentoManual() {
  const usuario = await exigirPapel(["colaborador"]);
  if (!usuario) redirect("/entrar");
  const [perfil, servicos, vinculos] = await Promise.all([
    db.from("usuarios").select("id,nome,especialidade,unidade_id").eq("id", usuario.id).single(),
    db.from("servicos").select("id,nome,preco,duracao_min").eq("ativo", true).order("ordem"),
    db.from("profissional_servicos").select("profissional_id,servico_id").eq("profissional_id", usuario.id),
  ]);
  if (perfil.error || servicos.error || vinculos.error) throw new Error("Não foi possível carregar o formulário.");
  const unidades = await db.from("unidades").select("id,nome").eq("ativo", true).order("nome");
  if (unidades.error) throw new Error("Não foi possível carregar as unidades.");
  return <><p className="etiqueta text-couro">Agenda própria</p><h1 className="mt-3 font-display text-4xl">Novo atendimento manual</h1><p className="mt-3 text-sm text-fumaca">A unidade válida será a configurada para você na data escolhida.</p><div className="max-w-3xl"><FormAgendar unidades={unidades.data || []} servicos={servicos.data || []} equipe={[perfil.data]} vinculos={vinculos.data || []} usuario={null} /></div></>;
}
