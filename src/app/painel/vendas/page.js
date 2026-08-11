import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";
import PainelVendas from "@/app/colaborador/vendas/PainelVendas";

export const dynamic = "force-dynamic";

export default async function VendasAdmin() {
  const admin = await exigirPapel(["admin"]);
  if (!admin) redirect("/entrar");

  const [servicos, produtos, colaboradores] = await Promise.all([
    db.from("servicos").select("id,nome,preco,ativo").eq("ativo", true).order("ordem"),
    db.from("produtos").select("id,nome,preco,estoque,ativo").eq("ativo", true).order("nome"),
    db.from("usuarios").select("id,nome").eq("papel", "colaborador").eq("ativo", true).order("nome"),
  ]);
  for (const resposta of [servicos, produtos, colaboradores]) if (resposta.error) throw new Error("Não foi possível carregar os dados de vendas.");
  return <PainelVendas servicos={servicos.data || []} produtos={produtos.data || []} colaboradores={colaboradores.data || []} />;
}
