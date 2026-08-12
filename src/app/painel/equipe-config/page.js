import Link from "next/link";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function ConfigEquipe() {
  const { data = [], error } = await db.from("usuarios").select("id,nome,ativo").eq("papel", "colaborador").is("excluido_em", null).order("nome");
  if (error) throw new Error("Não foi possível carregar a equipe.");
  return <><h1 className="font-display text-4xl">Serviços e horários da equipe</h1><div className="mt-8 max-w-2xl border border-linha bg-papel">{data.map((p) => <Link className="flex justify-between border-b p-5 last:border-0 hover:bg-marfim" key={p.id} href={`/painel/equipe-config/${p.id}`}><span>{p.nome}</span><span className="text-sm text-fumaca">{p.ativo ? "Ativo" : "Inativo"} →</span></Link>)}</div></>;
}
