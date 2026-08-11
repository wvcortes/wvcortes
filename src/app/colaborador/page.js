import { redirect } from "next/navigation";
import { db, conferirAmbiente } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";
import {
  diaLocal,
  limitesDoDia,
  hora,
  dinheiro,
} from "@/lib/formato";
import LinhaAgenda from "./LinhaAgenda";
import SeletorDia from "./SeletorDia";

export const dynamic = "force-dynamic";

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Confere se a data realmente existe.
 *
 * Exemplo válido:
 * 2026-08-11
 *
 * Exemplo inválido:
 * 2026-02-31
 */
function dataValida(valor) {
  if (
    typeof valor !== "string" ||
    !DATA_RE.test(valor)
  ) {
    return false;
  }

  const [ano, mes, dia] = valor
    .split("-")
    .map(Number);

  const teste = new Date(
    Date.UTC(
      ano,
      mes - 1,
      dia
    )
  );

  return (
    teste.getUTCFullYear() === ano &&
    teste.getUTCMonth() === mes - 1 &&
    teste.getUTCDate() === dia
  );
}

export default async function MinhaAgenda({
  searchParams,
}) {
  conferirAmbiente();

  /**
   * O layout já protege esta área,
   * mas mantemos a proteção também
   * na própria página.
   */
  const usuario = await exigirPapel([
    "colaborador",
  ]);

  if (!usuario) {
    redirect("/entrar");
  }

  /**
   * A data vem da URL:
   *
   * /colaborador?data=2026-08-11
   *
   * Como a URL pode ser alterada manualmente,
   * validamos antes de consultar o banco.
   */
  const dataInformada =
    searchParams?.data;

  const dia =
    dataValida(dataInformada)
      ? dataInformada
      : diaLocal();

  const {
    de,
    ate,
  } = limitesDoDia(dia);

  if (!de || !ate) {
    throw new Error(
      "Não foi possível determinar o período da agenda."
    );
  }

  /**
   * Carregamos agenda, serviços e vendas
   * ao mesmo tempo.
   */
  const [
    respostaAgenda,
    respostaServicos,
    respostaVendas,
  ] = await Promise.all([
    db
      .from("agendamentos")
      .select(
        [
          "id",
          "cliente_id",
          "nome_cliente",
          "telefone_cliente",
          "email_cliente",
          "profissional_id",
          "servico_id",
          "inicio",
          "fim",
          "status",
          "preco",
          "observacoes",
          "criado_em",
        ].join(",")
      )
      .eq(
        "profissional_id",
        usuario.id
      )
      .gte(
        "inicio",
        de
      )
      .lte(
        "inicio",
        ate
      )
      .order(
        "inicio",
        {
          ascending: true,
        }
      ),

    db
      .from("servicos")
      .select(
        [
          "id",
          "nome",
          "preco",
          "duracao_min",
        ].join(",")
      ),

    db
      .from("vendas")
      .select(
        [
          "id",
          "valor",
          "quantidade",
          "tipo",
          "criado_em",
        ].join(",")
      )
      .eq(
        "colaborador_id",
        usuario.id
      )
      .gte(
        "criado_em",
        de
      )
      .lte(
        "criado_em",
        ate
      ),
  ]);

  if (respostaAgenda.error) {
    throw new Error(
      `Não foi possível carregar a agenda: ${respostaAgenda.error.message}`
    );
  }

  if (respostaServicos.error) {
    throw new Error(
      `Não foi possível carregar os serviços: ${respostaServicos.error.message}`
    );
  }

  if (respostaVendas.error) {
    throw new Error(
      `Não foi possível carregar as vendas: ${respostaVendas.error.message}`
    );
  }

  const agenda =
    respostaAgenda.data || [];

  const servicos =
    respostaServicos.data || [];

  const vendas =
    respostaVendas.data || [];

  /**
   * Mapa para localizar o serviço
   * rapidamente pelo ID.
   */
  const servicosPorId =
    new Map(
      servicos.map(
        (servico) => [
          servico.id,
          servico,
        ]
      )
    );

  /**
   * Agendamentos cancelados continuam
   * aparecendo no histórico da lista,
   * mas não contam como horário ativo.
   */
  const agendaAtiva =
    agenda.filter(
      (agendamento) =>
        agendamento.status !==
        "cancelado"
    );

  /**
   * Total realmente lançado nas vendas
   * pelo colaborador naquele dia.
   */
  const totalDia =
    vendas.reduce(
      (
        soma,
        venda
      ) => {
        const valor =
          Number(
            venda.valor || 0
          );

        const quantidade =
          Number(
            venda.quantidade || 1
          );

        return (
          soma +
          valor *
            quantidade
        );
      },
      0
    );

  /**
   * Valor dos atendimentos que não
   * foram cancelados.
   */
  const previsto =
    agendaAtiva.reduce(
      (
        soma,
        agendamento
      ) =>
        soma +
        Number(
          agendamento.preco ||
            0
        ),
      0
    );

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etiqueta text-couro">
            Minha agenda
          </p>

          <h1 className="mt-3 font-display text-4xl">
            {dia
              .split("-")
              .reverse()
              .join("/")}
          </h1>
        </div>

        <SeletorDia
          dia={dia}
          base="/colaborador"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border border-linha bg-papel p-5 shadow-carta">
          <p className="etiqueta text-tinta/45">
            Horários
          </p>

          <p className="mt-2 font-display text-3xl">
            {
              agendaAtiva.length
            }
          </p>
        </div>

        <div className="border border-linha bg-papel p-5 shadow-carta">
          <p className="etiqueta text-tinta/45">
            Previsto na cadeira
          </p>

          <p className="mt-2 font-display text-3xl">
            {dinheiro(
              previsto
            )}
          </p>
        </div>

        <div className="border border-linha bg-papel p-5 shadow-carta">
          <p className="etiqueta text-tinta/45">
            Já lançado hoje
          </p>

          <p className="mt-2 font-display text-3xl text-couro">
            {dinheiro(
              totalDia
            )}
          </p>
        </div>
      </div>

      <div className="mt-8 border border-linha bg-papel shadow-carta">
        {agenda.length ===
          0 && (
          <p className="px-5 py-12 text-center text-sm text-fumaca">
            Nenhum horário nesse dia. Aproveite para organizar a bancada.
          </p>
        )}

        {agenda.map(
          (
            agendamento
          ) => (
            <LinhaAgenda
              key={
                agendamento.id
              }
              agendamento={
                agendamento
              }
              horaTexto={hora(
                agendamento.inicio
              )}
              servico={
                servicosPorId.get(
                  agendamento.servico_id
                ) ||
                null
              }
            />
          )
        )}
      </div>
    </>
  );
}