"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Aviso,
  Etiqueta,
} from "@/components/ui";
import { dinheiro } from "@/lib/formato";

const CORES = {
  agendado: "neutro",
  confirmado: "latao",
  concluido: "verde",
  cancelado: "vermelho",
};

const ROTULOS = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

async function lerJson(resposta) {
  try {
    return await resposta.json();
  } catch {
    return {};
  }
}

export default function LinhaAgenda({
  agendamento: a,
  horaTexto,
  servico,
}) {
  const router = useRouter();

  const [ocupado, setOcupado] =
    useState(false);

  const [erro, setErro] =
    useState("");

  /**
   * Altera a situação do atendimento.
   */
  async function mudar(status) {
    if (ocupado) {
      return;
    }

    /**
     * Confirma cancelamento para evitar
     * clique acidental.
     *
     * Ao cancelar, o horário é liberado
     * novamente para novos agendamentos.
     */
    if (status === "cancelado") {
      const confirmou =
        window.confirm(
          `Cancelar o horário de ${a.nome_cliente}?\n\nO horário ficará disponível novamente para outro cliente.`
        );

      if (!confirmou) {
        return;
      }
    }

    /**
     * Confirma conclusão para evitar
     * encerramento acidental.
     */
    if (status === "concluido") {
      const confirmou =
        window.confirm(
          `Marcar o atendimento de ${a.nome_cliente} como concluído?`
        );

      if (!confirmou) {
        return;
      }
    }

    setErro("");
    setOcupado(true);

    try {
      const resposta =
        await fetch(
          "/api/agendamentos",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id: a.id,
                status,
              }),
          }
        );

      const dados =
        await lerJson(
          resposta
        );

      if (!resposta.ok) {
        throw new Error(
          dados.erro ||
            "Não foi possível atualizar o atendimento."
        );
      }

      /**
       * Atualiza a página do colaborador
       * sem precisar recarregar manualmente.
       */
      router.refresh();
    } catch (e) {
      setErro(
        e?.message ||
          "Não foi possível atualizar o atendimento."
      );
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Fluxo permitido:
   *
   * AGENDADO
   * ↓
   * CONFIRMADO
   * ↓
   * CONCLUÍDO
   *
   * Agendado e confirmado também
   * podem ser cancelados.
   *
   * Concluído e cancelado são estados finais.
   */
  const podeConfirmar =
    a.status === "agendado";

  const podeConcluir =
    a.status === "agendado" ||
    a.status === "confirmado";

  const podeCancelar =
    a.status === "agendado" ||
    a.status === "confirmado";

  const finalizado =
    a.status === "concluido" ||
    a.status === "cancelado";

  return (
    <div
      className={`border-b border-linha/60 px-5 py-4 last:border-0 ${
        a.status === "cancelado"
          ? "bg-tinta/[0.025] opacity-70"
          : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={`font-mono ${
            a.status === "cancelado"
              ? "text-fumaca line-through"
              : "text-couro"
          }`}
        >
          {horaTexto}
        </span>

        <div className="min-w-[180px] flex-1">
          <p
            className={`font-medium ${
              a.status === "cancelado"
                ? "text-tinta/50 line-through"
                : ""
            }`}
          >
            {a.nome_cliente}
          </p>

          <p className="text-xs text-fumaca">
            {servico?.nome ||
              "Serviço"}{" "}
            ·{" "}
            {a.telefone_cliente}{" "}
            ·{" "}
            {dinheiro(
              a.preco
            )}
          </p>

          {a.observacoes ? (
            <p className="mt-1 text-xs italic text-fumaca">
              “
              {
                a.observacoes
              }
              ”
            </p>
          ) : null}
        </div>

        <Etiqueta
          cor={
            CORES[
              a.status
            ] || "neutro"
          }
        >
          {ROTULOS[
            a.status
          ] || a.status}
        </Etiqueta>

        {!finalizado ? (
          <div className="flex flex-wrap gap-2">
            {podeConfirmar ? (
              <button
                type="button"
                disabled={
                  ocupado
                }
                onClick={() =>
                  mudar(
                    "confirmado"
                  )
                }
                className="border border-linha px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-tinta/70 transition hover:border-couro hover:text-couro disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ocupado
                  ? "..."
                  : "Confirmar"}
              </button>
            ) : null}

            {podeConcluir ? (
              <button
                type="button"
                disabled={
                  ocupado
                }
                onClick={() =>
                  mudar(
                    "concluido"
                  )
                }
                className="border border-couro/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-couro transition hover:bg-couro hover:text-marfim disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ocupado
                  ? "..."
                  : "Concluir"}
              </button>
            ) : null}

            {podeCancelar ? (
              <button
                type="button"
                disabled={
                  ocupado
                }
                onClick={() =>
                  mudar(
                    "cancelado"
                  )
                }
                className="border border-red-800/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-800 transition hover:bg-red-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ocupado
                  ? "..."
                  : "Cancelar"}
              </button>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-fumaca">
            {a.status ===
            "concluido"
              ? "Atendimento finalizado"
              : "Horário liberado"}
          </span>
        )}
      </div>

      {erro ? (
        <div className="mt-3">
          <Aviso>
            {erro}
          </Aviso>
        </div>
      ) : null}
    </div>
  );
}