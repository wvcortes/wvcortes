import { db } from "@/lib/db";
import { semanaAtual } from "@/lib/fechamento";
import PainelFechamentos from "./PainelFechamentos";

export const dynamic = "force-dynamic";

export default async function Fechamentos() {
  const { data = [], error } = await db.from("usuarios").select("id,nome,ativo,excluido_em").eq("papel", "colaborador").order("nome");
  if (error) throw new Error("Não foi possível carregar a equipe.");
  const profissionais = data.map((p) => ({ ...p, nome: `${p.nome}${p.excluido_em ? " (arquivado)" : !p.ativo ? " (inativo)" : ""}` }));
  return <><h1 className="text-4xl font-bold">Fechamento semanal</h1><p className="mt-2 text-fumaca">Produção, comissões, pendências e ajustes por colaborador, inclusive inativos ou arquivados.</p><PainelFechamentos profissionais={profissionais} semana={semanaAtual()} /></>;
}
