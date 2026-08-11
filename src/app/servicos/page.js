import Link from "next/link";
import { db, pegarBarbearia } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { dinheiro } from "@/lib/formato";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
export const dynamic = "force-dynamic";
export default async function Servicos() {
  const [barbearia, usuario, resposta] = await Promise.all([pegarBarbearia(), usuarioAtual().catch(()=>null), db.from("servicos").select("id,nome,descricao,preco,duracao_min,categoria").eq("ativo",true).order("ordem",{ascending:true})]);
  const servicos = resposta.data || [];
  const categorias = [...new Set(servicos.map(s=>s.categoria || "Barbearia"))];
  return <><SiteHeader barbearia={barbearia} usuario={usuario}/><main><section className="bg-tinta px-5 py-16 text-marfim sm:py-24"><div className="mx-auto max-w-7xl"><p className="etiqueta text-latao">Menu da casa</p><h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-tight sm:text-7xl">Serviços feitos com precisão.</h1><p className="mt-5 max-w-xl text-marfim/60">Escolha seu cuidado e reserve o melhor horário para você.</p></div></section><div className="secao">{categorias.map(cat=><section key={cat} className="mb-16 last:mb-0"><div className="flex items-center gap-4"><h2 className="font-display text-3xl font-semibold">{cat}</h2><span className="h-px flex-1 bg-linha"/></div><div className="mt-7 grid gap-5 md:grid-cols-2">{servicos.filter(s=>(s.categoria||"Barbearia")===cat).map(s=><article key={s.id} className="card-premium flex flex-col p-6 sm:p-7"><div className="flex items-start justify-between gap-5"><h3 className="font-display text-2xl font-semibold">{s.nome}</h3><strong className="whitespace-nowrap font-mono text-lg text-couro">{dinheiro(s.preco)}</strong></div>{s.descricao&&<p className="mt-3 flex-1 text-sm leading-relaxed text-fumaca">{s.descricao}</p>}<div className="mt-6 flex items-center justify-between border-t border-linha pt-4"><span className="etiqueta text-fumaca">{s.duracao_min} minutos</span><Link href="/agendar" className="text-sm font-semibold text-couro">Agendar →</Link></div></article>)}</div></section>)}<div className="mt-16 rounded-3xl bg-couro px-6 py-12 text-center text-marfim"><h2 className="font-display text-4xl">Pronto para renovar o visual?</h2><Link href="/agendar" className="mt-7 inline-flex rounded-lg bg-latao px-7 py-3.5 text-sm font-bold text-tinta hover:bg-white">AGENDAR HORÁRIO</Link></div></div></main><SiteFooter barbearia={barbearia}/></>;
}
