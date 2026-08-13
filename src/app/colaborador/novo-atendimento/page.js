import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";
import AtendimentoForm from "./AtendimentoForm";
export const dynamic = "force-dynamic";
export default async function NovoAtendimento() {
  const usuario=await exigirPapel(["admin","colaborador"]); if(!usuario)redirect("/entrar");
  const [s,p,u]=await Promise.all([
    db.from("servicos").select("id,nome,preco,preco_minimo,preco_variavel").eq("ativo",true).order("ordem"),
    db.from("produtos").select("id,nome,preco,estoque").eq("ativo",true).order("nome"),
    db.from("unidades").select("id,nome").eq("ativo",true).is("excluido_em",null).order("nome"),
  ]);
  if(s.error||p.error||u.error)throw new Error("Não foi possível carregar a comanda.");
  return <><p className="etiqueta text-couro">Ordem de chegada</p><h1 className="mt-2 text-4xl font-bold">Novo atendimento</h1><p className="mt-2 text-fumaca">A data, hora, preços e comissões são determinados pelo servidor.</p><AtendimentoForm servicos={s.data||[]} produtos={p.data||[]} unidades={u.data||[]} admin={usuario.papel==="admin"}/></>;
}
