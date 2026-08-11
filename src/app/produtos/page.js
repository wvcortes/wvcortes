import { db, pegarBarbearia } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Carrinho from "./Carrinho";
export const dynamic = "force-dynamic";
export default async function Produtos() {
  const [barbearia, usuario, resposta] = await Promise.all([pegarBarbearia(), usuarioAtual().catch(() => null), db.from("produtos").select("id,nome,descricao,preco,estoque,foto_url").eq("ativo", true).order("nome")]);
  if (resposta.error) throw new Error("Não foi possível carregar os produtos.");
  return <><SiteHeader barbearia={barbearia} usuario={usuario} /><main><section className="bg-tinta px-5 py-16 text-marfim sm:py-24"><div className="mx-auto max-w-7xl"><p className="etiqueta text-latao">Seleção WV</p><h1 className="mt-4 font-display text-5xl font-semibold sm:text-7xl">Produtos para manter o estilo.</h1><p className="mt-5 max-w-xl text-marfim/60">Monte seu pedido. O estoque só muda quando a venda for confirmada e lançada pela equipe.</p></div></section><div className="secao"><Carrinho produtos={resposta.data || []} /></div></main><SiteFooter barbearia={barbearia} /></>;
}
