import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";
import AtendimentoForm from "./AtendimentoForm";
export const dynamic = "force-dynamic";
export default async function NovoAtendimento() {
  const usuario = await exigirPapel(["colaborador"]); if (!usuario) redirect("/entrar");
  const [s,p] = await Promise.all([db.from("servicos").select("id,nome,preco").eq("ativo",true).order("ordem"),db.from("produtos").select("id,nome,preco,estoque").eq("ativo",true).order("nome")]);
  if(s.error||p.error) throw new Error("Não foi possível carregar a comanda.");
  return <><p className="etiqueta text-couro">Ordem de chegada</p><h1 className="mt-2 text-4xl font-bold">Novo atendimento</h1><p className="mt-2 text-fumaca">Feche a comanda do cliente. A data e a hora serão registradas pelo servidor.</p><AtendimentoForm servicos={s.data||[]} produtos={p.data||[]} /></>;
}
