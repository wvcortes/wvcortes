"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Botao,
  Campo,
  Entrada,
  Aviso,
  entradaCls,
} from "@/components/ui";

import {
  dinheiro,
  diaLocal,
} from "@/lib/formato";

export default function FormAgendar({
  servicos,
  equipe,
  unidades = [],
  vinculos = [],
  usuario,
}) {
  const [f, setF] = useState({
    unidade_id: unidades[0]?.id || "",
    nome_cliente:
      usuario?.nome || "",

    telefone_cliente:
      usuario?.telefone || "",

    email_cliente:
      usuario?.email || "",

    servico_id:
      servicos[0]?.id || "",

    profissional_id: "",

    data:
      diaLocal(),

    horario: "",

    observacoes: "",
  });

  /**
   * Agora guardamos TODOS os horários:
   *
   * livre
   * ocupado
   * passado
   * encerramento
   */
  const [equipeFiltrada, setEquipeFiltrada] = useState([]);
  const servicosFiltrados = servicos;

  useEffect(() => {
    if (!f.unidade_id || !f.servico_id || !f.data) {
      setEquipeFiltrada([]);
      setF((a) => ({ ...a, profissional_id: "", horario: "" }));
      return;
    }
    const controle = new AbortController();
    const parametros = new URLSearchParams({ unidade: f.unidade_id, servico: f.servico_id, data: f.data });
    fetch(`/api/profissionais?${parametros}`, { cache: "no-store", signal: controle.signal })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.erro); return d; })
      .then((d) => {
        const lista = d.profissionais || [];
        setEquipeFiltrada(lista);
        setF((a) => ({ ...a, profissional_id: lista.some((p) => p.id === a.profissional_id) ? a.profissional_id : "", horario: "" }));
      })
      .catch((e) => { if (e.name !== "AbortError") setErro(e.message || "Não foi possível consultar os profissionais."); });
    return () => controle.abort();
  }, [f.unidade_id, f.servico_id, f.data]);

  const [slots, setSlots] =
    useState([]);

  const [buscando, setBuscando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  const [pronto, setPronto] =
    useState(null);

  const [enviando, setEnviando] =
    useState(false);

  const RECALCULA = [
    "servico_id",
    "profissional_id",
    "data",
  ];

  const mudar =
    (campo) => (e) => {
      const valor =
        e.target.value;

      setErro("");

      setF((anterior) => ({
        ...anterior,

        [campo]: valor,

        ...(RECALCULA.includes(campo)
          ? {
              horario: "",
            }
          : {}),
      }));
    };

  /**
   * Carrega a grade atualizada.
   *
   * silencioso=true é usado na atualização
   * automática para não ficar piscando
   * "Consultando..." na tela.
   */
  const carregarHorarios =
    useCallback(
      async (
        silencioso = false
      ) => {
        if (
          !f.data ||
          !f.profissional_id
        ) {
          setSlots([]);
          return;
        }

        if (!silencioso) {
          setBuscando(true);
        }

        try {
          const parametros =
            new URLSearchParams({
              data:
                f.data,

              profissional:
                f.profissional_id,

              servico:
                f.servico_id,

              unidade: f.unidade_id,
            });

          const resposta =
            await fetch(
              `/api/horarios?${parametros.toString()}`,
              {
                cache: "no-store",
              }
            );

          let dados = {};

          try {
            dados =
              await resposta.json();
          } catch {
            dados = {};
          }

          if (!resposta.ok) {
            throw new Error(
              dados.erro ||
                "Não foi possível consultar os horários."
            );
          }

          /**
           * Compatibilidade:
           *
           * Se por algum motivo a API antiga
           * responder somente "horarios",
           * continuamos funcionando.
           */
          const novosSlots =
            Array.isArray(
              dados.slots
            )
              ? dados.slots
              : (
                  dados.horarios ||
                  []
                ).map(
                  (horario) => ({
                    horario,
                    disponivel:
                      true,
                    motivo:
                      null,
                  })
                );

          setSlots(
            novosSlots
          );

          /**
           * Se o cliente estava com 14:00
           * selecionado e outra pessoa acabou
           * de pegar 14:00, desmarcamos.
           */
          setF(
            (anterior) => {
              if (
                !anterior.horario
              ) {
                return anterior;
              }

              const atual =
                novosSlots.find(
                  (slot) =>
                    slot.horario ===
                    anterior.horario
                );

              if (
                atual?.disponivel
              ) {
                return anterior;
              }

              return {
                ...anterior,
                horario: "",
              };
            }
          );
        } catch (e) {
          if (!silencioso) {
            setErro(
              e?.message ||
                "Não foi possível consultar os horários."
            );
          }
        } finally {
          if (!silencioso) {
            setBuscando(false);
          }
        }
      },
      [
        f.unidade_id,
        f.data,
        f.profissional_id,
        f.servico_id,
      ]
    );

  /**
   * Atualiza imediatamente quando:
   *
   * - serviço muda
   * - profissional muda
   * - data muda
   *
   * E depois consulta novamente
   * automaticamente a cada 15 segundos.
   */
  useEffect(() => {
    carregarHorarios();

    const intervalo =
      window.setInterval(
        () => {
          carregarHorarios(
            true
          );
        },
        15000
      );

    return () => {
      window.clearInterval(
        intervalo
      );
    };
  }, [carregarHorarios]);

  async function enviar(e) {
    e.preventDefault();

    setErro("");

    if (!f.horario) {
      setErro(
        "Escolha um horário disponível."
      );

      return;
    }

    /**
     * Confere mais uma vez no estado atual
     * antes de enviar.
     */
    const slot =
      slots.find(
        (item) =>
          item.horario ===
          f.horario
      );

    if (
      slot &&
      !slot.disponivel
    ) {
      setF(
        (anterior) => ({
          ...anterior,
          horario: "",
        })
      );

      setErro(
        "Esse horário não está mais disponível. Escolha outro."
      );

      await carregarHorarios();

      return;
    }

    setEnviando(true);

    try {
      const resposta =
        await fetch(
          "/api/agendamentos",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(f),
          }
        );

      let dados = {};

      try {
        dados =
          await resposta.json();
      } catch {
        dados = {};
      }

      if (!resposta.ok) {
        /**
         * 409 = alguém ocupou o horário
         * praticamente ao mesmo tempo.
         */
        if (
          resposta.status ===
          409
        ) {
          setF(
            (anterior) => ({
              ...anterior,
              horario: "",
            })
          );

          await carregarHorarios();
        }

        throw new Error(
          dados.erro ||
            "Não foi possível realizar o agendamento."
        );
      }

      setPronto(
        dados.agendamento
      );
    } catch (e2) {
      setErro(
        e2?.message ||
          "Não foi possível realizar o agendamento."
      );
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    const servico =
      servicos.find(
        (s) =>
          s.id ===
          f.servico_id
      );

    const profissional =
      equipe.find(
        (p) =>
          p.id ===
          f.profissional_id
      );

    return (
      <div className="papel-recibo mt-12 border border-linha p-8 shadow-carta">
        <p className="etiqueta text-couro">
          Horário confirmado
        </p>

        <p className="mt-4 font-display text-3xl">
          {f.nome_cliente},
          está marcado.
        </p>

        <dl className="mt-8 space-y-3 font-mono text-sm">
          <div className="linha-preco">
            <dt>
              Serviço
            </dt>

            <span className="pontos" />

            <dd>
              {
                servico?.nome
              }
            </dd>
          </div>

          <div className="linha-preco">
            <dt>
              Profissional
            </dt>

            <span className="pontos" />

            <dd>
              {
                profissional?.nome
              }
            </dd>
          </div>

          <div className="linha-preco">
            <dt>
              Data
            </dt>

            <span className="pontos" />

            <dd>
              {f.data
                .split("-")
                .reverse()
                .join("/")}{" "}
              · {f.horario}
            </dd>
          </div>

          <div className="linha-preco">
            <dt>
              Valor
            </dt>

            <span className="pontos" />

            <dd className="text-couro">
              {dinheiro(
                servico?.preco
              )}
            </dd>
          </div>
        </dl>

        <Botao
          type="button"
          className="mt-8 mr-3"
          onClick={() => window.open(`/api/agendamentos/${pronto.id}/whatsapp`, "_blank", "noopener,noreferrer")}
        >
          Abrir WhatsApp do profissional
        </Botao>

        <Botao
          variante="contorno"
          className="mt-8"
          onClick={async () => {
            setPronto(null);

            setF(
              (anterior) => ({
                ...anterior,
                horario: "",
              })
            );

            await carregarHorarios();
          }}
        >
          Marcar outro horário
        </Botao>
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="mt-10 space-y-7 rounded-2xl border border-linha bg-papel p-5 shadow-carta sm:p-8"
    >
      <Campo rotulo="1. Unidade">
        <select value={f.unidade_id} onChange={(e) => {
          const unidade_id = e.target.value;
          setF((a) => ({ ...a, unidade_id, profissional_id: "", horario: "" }));
        }} className={entradaCls} required>
          <option value="">Selecione</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </Campo>
      {erro ? (
        <Aviso>
          {erro}
        </Aviso>
      ) : null}

      <Campo rotulo="2. Serviço">
          <select
            value={
              f.servico_id
            }
            onChange={
              mudar(
                "servico_id"
              )
            }
            className={
              entradaCls
            }
            required
          >
            {servicosFiltrados.map(
              (servico) => (
                <option
                  key={
                    servico.id
                  }
                  value={
                    servico.id
                  }
                >
                  {servico.nome} —{" "}
                  {dinheiro(
                    servico.preco
                  )}{" "}
                  ·{" "}
                  {
                    servico.duracao_min
                  }{" "}
                  min
                </option>
              )
            )}
          </select>
      </Campo>

      <Campo rotulo="3. Data">
        <Entrada type="date" value={f.data} min={diaLocal()} onChange={mudar("data")} required />
      </Campo>

      <Campo rotulo="4. Profissional">
          <select
            value={
              f.profissional_id
            }
            onChange={
              mudar(
                "profissional_id"
              )
            }
            className={
              entradaCls
            }
            required
          >
            <option value="">Selecione</option>
            {equipeFiltrada.map(
              (
                profissional
              ) => (
                <option
                  key={
                    profissional.id
                  }
                  value={
                    profissional.id
                  }
                >
                  {
                    profissional.nome
                  }
                </option>
              )
            )}
          </select>
      </Campo>

      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="etiqueta text-tinta/60">
            5. Horário
          </span>

          {buscando &&
          slots.length >
            0 ? (
            <span className="text-[11px] text-fumaca">
              Atualizando...
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {buscando &&
          slots.length ===
            0 ? (
            <p className="text-sm text-fumaca">
              Consultando a agenda...
            </p>
          ) : null}

          {!buscando &&
          slots.length ===
            0 ? (
            <p className="text-sm text-fumaca">
              Nenhum horário disponível nesse dia. Tente outra data.
            </p>
          ) : null}

          {slots.map(
            (slot) => {
              const selecionado =
                f.horario ===
                slot.horario;

              const ocupado =
                slot.motivo ===
                "ocupado";

              let titulo = "";

              if (ocupado) {
                titulo =
                  "Horário ocupado";
              } else if (
                slot.motivo ===
                "passado"
              ) {
                titulo =
                  "Horário já passou";
              } else if (
                slot.motivo ===
                "encerramento"
              ) {
                titulo =
                  "O serviço não termina antes do fechamento";
              }

              return (
                <button
                  type="button"
                  key={
                    slot.horario
                  }
                  disabled={
                    !slot.disponivel
                  }
                  title={
                    titulo
                  }
                  onClick={() =>
                    setF(
                      (
                        anterior
                      ) => ({
                        ...anterior,

                        horario:
                          slot.horario,
                      })
                    )
                  }
                  className={`relative min-w-[72px] rounded-lg border px-3.5 py-2.5 font-mono text-sm transition ${
                    selecionado
                      ? "border-couro bg-couro text-marfim shadow-md"
                      : slot.disponivel
                      ? "border-linha bg-white hover:border-couro hover:bg-couro/5 hover:text-couro"
                      : "cursor-not-allowed border-linha/40 bg-tinta/[0.03] text-tinta/25 opacity-60"
                  }`}
                >
                  {
                    slot.horario
                  }
                </button>
              );
            }
          )}
        </div>

        {slots.some(
          (slot) =>
            !slot.disponivel
        ) ? (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-fumaca">
            <span className="inline-block h-3 w-5 border border-linha/40 bg-tinta/[0.03] opacity-60" />
            <span>
              Horários apagados estão indisponíveis.
            </span>
          </div>
        ) : null}
      </div>

      <p className="etiqueta text-tinta/60">6. Dados do cliente</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Seu nome *">
          <Entrada
            value={
              f.nome_cliente
            }
            onChange={
              mudar(
                "nome_cliente"
              )
            }
            required
          />
        </Campo>

        <Campo rotulo="Telefone *">
          <Entrada
            value={
              f.telefone_cliente
            }
            onChange={
              mudar(
                "telefone_cliente"
              )
            }
            required
          />
        </Campo>
      </div>

      <Campo rotulo="E-mail">
        <Entrada
          type="email"
          value={
            f.email_cliente
          }
          onChange={
            mudar(
              "email_cliente"
            )
          }
        />
      </Campo>

      <Campo rotulo="Observações">
        <textarea
          rows={3}
          value={
            f.observacoes
          }
          onChange={
            mudar(
              "observacoes"
            )
          }
          className={
            entradaCls
          }
          placeholder="Alguma preferência de corte?"
        />
      </Campo>

      <Botao
        type="submit"
        disabled={
          enviando ||
          !f.horario
        }
        className="w-full"
      >
        {enviando
          ? "Marcando..."
          : f.horario
          ? `Confirmar ${f.horario}`
          : "Escolha um horário para confirmar"}
      </Botao>
    </form>
  );
}
