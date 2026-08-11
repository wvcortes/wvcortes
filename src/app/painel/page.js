import Link from "next/link";
import { db } from "@/lib/db";
import { dinheiro, hora, diaLocal, limitesDoDia } from "@/lib/formato";

export const dynamic = "force-dynamic";

function Indicador({ rotulo, valor, nota }) {
  return (
    <div className="border border-linha bg-papel p-6 shadow-carta">
      <p className="etiqueta text-tinta/45">{rotulo}</p>
      <p className="mt-3 font-display text-4xl">{valor}</p>
      {nota ? <p className="mt-1 text-xs text-fumaca">{nota}</p> : null}
    </div>
  );
}

export default async function VisaoGeral() {
  const hoje = diaLocal();
  const { de, ate } = limitesDoDia(hoje);

  const [{ data: vendasHoje = [] }, { data: agendaHoje = [] }, { data: assinaturas = [] }, { data: clientes = [] }, { data: equipe = [] }, { data: servicos = [] }] =
    await Promise.all([
      db.from("vendas").select("*").gte("criado_em", de).lte("criado_em", ate),
      db.from("agendamentos").select("*").gte("inicio", de).lte("inicio", ate).order("inicio"),
      db.from("assinaturas").select("valor, status").eq("status", "ativa"),
      db.from("usuarios").select("id").eq("papel", "cliente"),
      db.from("usuarios").select("id, nome").eq("papel", "colaborador"),
      db.from("servicos").select("id, nome"),
    ]);

  const total = (vendasHoje || []).reduce((s, v) => s + Number(v.valor) * (v.quantidade || 1), 0);
  const recorrente = (assinaturas || []).reduce((s, a) => s + Number(a.valor || 0), 0);
  const nomeDe = (id, lista) => lista.find((x) => x.id === id)?.nome || "—";

  const porColaborador = (equipe || []).map((c) => {
    const minhas = (vendasHoje || []).filter((v) => v.colaborador_id === c.id);
    return {
      ...c,
      total: minhas.reduce((s, v) => s + Number(v.valor) * (v.quantidade || 1), 0),
      qtd: minhas.length,
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="etiqueta text-couro">Hoje · {hoje.split("-").reverse().join("/")}</p>
          <h1 className="mt-3 font-display text-4xl">Visão geral</h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Caixa do dia" valor={dinheiro(total)} nota={`${vendasHoje?.length || 0} lançamentos`} />
        <Indicador rotulo="Na agenda hoje" valor={agendaHoje?.length || 0} />
        <Indicador rotulo="Receita recorrente" valor={dinheiro(recorrente)} nota={`${assinaturas?.length || 0} assinaturas ativas`} />
        <Indicador rotulo="Clientes cadastrados" valor={clientes?.length || 0} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
        <section>
          <h2 className="etiqueta text-tinta/45">Agenda de hoje</h2>
          <div className="mt-4 border border-linha bg-papel shadow-carta">
            {(agendaHoje || []).length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-fumaca">
                Nenhum horário marcado para hoje.
              </p>
            )}
            {(agendaHoje || []).map((a) => (
              <div key={a.id} className="flex items-center gap-4 border-b border-linha/60 px-5 py-4 last:border-0">
                <span className="font-mono text-sm text-couro">{hora(a.inicio)}</span>
                <div className="flex-1">
                  <p className="font-medium">{a.nome_cliente}</p>
                  <p className="text-xs text-fumaca">
                    {nomeDe(a.servico_id, servicos || [])} · {nomeDe(a.profissional_id, equipe || [])}
                  </p>
                </div>
                <span className="etiqueta text-tinta/45">{a.status}</span>
              </div>
            ))}
          </div>
          <Link href="/painel/agendamentos" className="etiqueta mt-4 inline-block text-couro">
            abrir agenda completa →
          </Link>
        </section>

        {/* Recibo do dia: o fechamento de caixa como um papel de comanda. */}
        <section>
          <h2 className="etiqueta text-tinta/45">Fechamento por barbeiro</h2>
          <div className="papel-recibo mt-4 border border-linha p-6 shadow-carta">
            <p className="etiqueta text-tinta/40">{hoje.split("-").reverse().join("/")}</p>
            <div className="mt-5 space-y-3">
              {porColaborador.map((c) => (
                <div key={c.id} className="linha-preco">
                  <span>{c.nome}</span>
                  <span className="pontos" />
                  <span className="font-mono text-sm">{dinheiro(c.total)}</span>
                </div>
              ))}
              {porColaborador.length === 0 && (
                <p className="text-sm text-fumaca">Cadastre a equipe para ver o fechamento.</p>
              )}
            </div>
            <div className="mt-6 border-t border-dashed border-tinta/25 pt-4">
              <div className="linha-preco font-semibold">
                <span>Total</span>
                <span className="pontos" />
                <span className="font-mono text-couro">{dinheiro(total)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
