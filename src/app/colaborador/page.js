import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";
import { resolverUnidadeEfetiva } from "@/lib/unidades";
import { diaLocal, limitesDoDia, dinheiro, hora } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function InicioColaborador() {
  const usuario = await exigirPapel(["colaborador"]);
  if (!usuario) redirect("/entrar");
  const hoje = diaLocal();
  const { de, ate } = limitesDoDia(hoje);
  const unidadeId = await resolverUnidadeEfetiva(usuario.id, hoje, usuario.unidade_id);
  const [unidade, ponto, atendimentos] = await Promise.all([
    unidadeId ? db.from("unidades").select("nome").eq("id", unidadeId).maybeSingle() : { data: null },
    db.from("ponto_registros").select("tipo,status,registrado_em").eq("colaborador_id", usuario.id).gte("registrado_em", de).lte("registrado_em", ate).order("registrado_em", { ascending: false }).limit(1),
    db.from("atendimentos").select("subtotal_servicos,subtotal_produtos,total,comissao_servicos,comissao_produtos").eq("colaborador_id", usuario.id).gte("finalizado_em", de).lte("finalizado_em", ate).eq("status", "FINALIZADO"),
  ]);
  const ultimo = ponto.data?.[0];
  const itens = atendimentos.data || [];
  const soma = (campo) => itens.reduce((n, x) => n + Number(x[campo] || 0), 0);
  const proxima = !ultimo ? "REGISTRAR ENTRADA" : ultimo.tipo === "ENTRADA" ? "INICIAR INTERVALO" : ultimo.tipo === "INICIO_INTERVALO" ? "RETORNAR DO INTERVALO" : ultimo.tipo === "RETORNO" ? "REGISTRAR SAÍDA" : "JORNADA ENCERRADA";
  const descricaoComissao = (tipo, valor, unidade) => tipo === "percentual" ? `${Number(valor)}%` : tipo === "fixo" ? `${dinheiro(valor)} por ${unidade}` : "Não configurada";
  return <div className="space-y-7">
    <div className="grid gap-4 lg:grid-cols-2">
      <Link href="/colaborador/ponto" className="rounded-3xl border border-[#d27b3c]/50 bg-[#173229] p-6 shadow-xl sm:p-8">
        <p className="etiqueta text-[#e2924a]">MEU PONTO</p><h1 className="mt-3 text-3xl font-bold">{proxima}</h1>
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm"><div><p className="text-[#9ea69e]">Unidade de hoje</p><p className="mt-1 font-semibold">{unidade.data?.nome || "Não definida"}</p></div><div><p className="text-[#9ea69e]">Última marcação</p><p className="mt-1 font-semibold">{ultimo ? hora(ultimo.registrado_em) : "Nenhuma"}</p></div><div><p className="text-[#9ea69e]">Localização</p><p className="mt-1 font-semibold">{ultimo?.status || "Aguardando validação"}</p></div></div>
      </Link>
      <Link href="/colaborador/novo-atendimento" className="flex min-h-52 items-center justify-center rounded-3xl bg-[#c96f32] p-8 text-center text-[#09100d] shadow-xl transition hover:bg-[#df8240]">
        <span className="text-3xl font-black sm:text-4xl">+ NOVO ATENDIMENTO</span>
      </Link>
    </div>
    <section><p className="etiqueta text-couro">Hoje</p><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
      {[["Atendimentos", itens.length],["Serviços", dinheiro(soma("subtotal_servicos"))],["Produtos", dinheiro(soma("subtotal_produtos"))],["Produção", dinheiro(soma("total"))],["Comissão", dinheiro(soma("comissao_servicos")+soma("comissao_produtos"))]].map(([l,v])=><div key={l} className="rounded-2xl border border-linha bg-papel p-5"><p className="text-xs text-fumaca">{l}</p><p className="mt-2 text-xl font-bold">{v}</p></div>)}
    </div></section>
    <section className="rounded-2xl border border-linha bg-papel p-5"><p className="etiqueta text-couro">MINHAS COMISSÕES</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><p>Serviços: <b>{descricaoComissao(usuario.servico_comissao_tipo,usuario.servico_comissao_valor,"serviço")}</b></p><p>Produtos: <b>{descricaoComissao(usuario.produto_comissao_tipo,usuario.produto_comissao_valor,"unidade")}</b></p></div></section>
  </div>;
}
