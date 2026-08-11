import Link from "next/link";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";
import { dinheiro, dataHora, dataCurta } from "@/lib/formato";
import { Etiqueta } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MinhaConta() {
  const u = await exigirPapel(["cliente"]);

  const { data: agendamentos = [] } = await db
    .from("agendamentos")
    .select("*")
    .or(`cliente_id.eq.${u.id},email_cliente.eq.${u.email}`)
    .order("inicio", { ascending: false })
    .limit(20);

  const { data: assinaturas = [] } = await db
    .from("assinaturas")
    .select("*")
    .eq("cliente_id", u.id)
    .order("criado_em", { ascending: false });

  const { data: planos = [] } = await db.from("planos").select("id, nome");
  const { data: servicos = [] } = await db.from("servicos").select("id, nome");
  const nomePlano = (id) => (planos || []).find((p) => p.id === id)?.nome || "Plano";
  const nomeServico = (id) => (servicos || []).find((s) => s.id === id)?.nome || "Serviço";

  const agora = new Date();
  const proximos = (agendamentos || []).filter(
    (a) => new Date(a.inicio) >= agora && a.status !== "cancelado"
  );
  const anteriores = (agendamentos || []).filter((a) => new Date(a.inicio) < agora);

  return (
    <>
      <p className="etiqueta text-couro">Minha conta</p>
      <h1 className="mt-3 font-display text-4xl">Olá, {u.nome.split(" ")[0]}</h1>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <section>
          <h2 className="etiqueta text-tinta/45">Próximos horários</h2>
          <div className="mt-4 border border-linha bg-papel shadow-carta">
            {proximos.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-fumaca">Você não tem horário marcado.</p>
                <Link href="/agendar" className="etiqueta mt-3 inline-block text-couro">
                  marcar agora →
                </Link>
              </div>
            )}
            {proximos.map((a) => (
              <div key={a.id} className="border-b border-linha/60 px-5 py-4 last:border-0">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm text-couro">{dataHora(a.inicio)}</p>
                  <Etiqueta cor={a.status === "confirmado" ? "verde" : "neutro"}>{a.status}</Etiqueta>
                </div>
                <p className="mt-1">{nomeServico(a.servico_id)}</p>
                <p className="text-xs text-fumaca">{dinheiro(a.preco)}</p>
              </div>
            ))}
          </div>

          {anteriores.length > 0 && (
            <>
              <h2 className="etiqueta mt-10 text-tinta/45">Histórico</h2>
              <div className="mt-4 border border-linha bg-papel shadow-carta">
                {anteriores.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between border-b border-linha/60 px-5 py-3 text-sm last:border-0"
                  >
                    <span className="font-mono text-xs text-fumaca">{dataHora(a.inicio)}</span>
                    <span>{nomeServico(a.servico_id)}</span>
                    <span className="font-mono text-xs">{dinheiro(a.preco)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section>
          <h2 className="etiqueta text-tinta/45">Meu plano</h2>
          <div className="mt-4 space-y-4">
            {(assinaturas || []).length === 0 && (
              <div className="border border-dashed border-linha bg-papel px-6 py-10 text-center">
                <p className="font-display text-xl">Sem assinatura ativa</p>
                <p className="mt-2 text-sm text-fumaca">
                  Os planos economizam quem passa aqui mais de uma vez por mês.
                </p>
                <Link
                  href="/planos"
                  className="mt-5 inline-block bg-tinta px-5 py-2.5 text-sm font-semibold text-marfim hover:bg-couro"
                >
                  Ver planos
                </Link>
              </div>
            )}
            {(assinaturas || []).map((a) => (
              <div key={a.id} className="border border-linha bg-papel p-6 shadow-carta">
                <div className="flex items-center justify-between">
                  <p className="font-display text-2xl">{nomePlano(a.plano_id)}</p>
                  <Etiqueta cor={a.status === "ativa" ? "verde" : a.status === "pendente" ? "latao" : "vermelho"}>
                    {a.status}
                  </Etiqueta>
                </div>
                <p className="mt-3 font-mono text-lg">{dinheiro(a.valor)}/mês</p>
                <p className="mt-2 text-xs text-fumaca">
                  Desde {dataCurta(a.inicio)}
                  {a.proxima_cobranca ? ` · próxima cobrança em ${dataCurta(a.proxima_cobranca)}` : ""}
                </p>
                {a.status === "pendente" && (
                  <p className="mt-4 border-t border-linha pt-4 text-sm text-fumaca">
                    A barbearia confirma a assinatura assim que o pagamento entrar.
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 border border-linha bg-papel p-6">
            <p className="etiqueta text-tinta/45">Meus dados</p>
            <p className="mt-3 text-sm">{u.nome}</p>
            <p className="text-sm text-fumaca">{u.email}</p>
            <p className="text-sm text-fumaca">{u.telefone}</p>
          </div>
        </section>
      </div>
    </>
  );
}
