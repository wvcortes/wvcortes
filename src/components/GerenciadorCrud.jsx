"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Botao,
  Campo,
  Entrada,
  Etiqueta,
  entradaCls,
} from "@/components/ui";

import {
  dinheiro,
  dataHora,
  FUSO_NOME,
} from "@/lib/formato";

async function lerResposta(resposta) {
  try {
    return await resposta.json();
  } catch {
    return {};
  }
}

function tratarErroSalvar(
  recurso,
  resposta,
  dados
) {
  const original = String(
    dados?.erro || ""
  ).trim();

  const texto =
    original.toLowerCase();

  const conflitoAgenda =
    recurso === "agendamentos" &&
    (
      resposta.status === 409 ||
      texto.includes("sobrepos") ||
      texto.includes("conflit") ||
      texto.includes("ocupado") ||
      texto.includes("horário") ||
      texto.includes("horario") ||
      texto.includes(
        "agendamentos_sem_sobreposicao"
      )
    );

  if (conflitoAgenda) {
    return {
      titulo:
        "Horário indisponível",

      mensagem:
        "Horário já sendo usado. Esse profissional já possui um atendimento nesse período. Escolha outro horário.",
    };
  }

  return {
    titulo:
      "Não foi possível salvar",

    mensagem:
      original ||
      "Não foi possível salvar o registro.",
  };
}

function mostrarDataSimples(
  valor
) {
  const texto =
    String(
      valor || ""
    ).slice(0, 10);

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      texto
    );

  if (!match) {
    return texto;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function paraDataHoraLocal(
  valor
) {
  if (!valor) {
    return "";
  }

  const data =
    new Date(valor);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return "";
  }

  const partes =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          FUSO_NOME,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      }
    ).formatToParts(
      data
    );

  const mapa =
    Object.fromEntries(
      partes
        .filter(
          (parte) =>
            parte.type !==
            "literal"
        )
        .map(
          (parte) => [
            parte.type,
            parte.value,
          ]
        )
    );

  if (
    !mapa.year ||
    !mapa.month ||
    !mapa.day ||
    mapa.hour ===
      undefined ||
    mapa.minute ===
      undefined
  ) {
    return "";
  }

  return (
    `${mapa.year}-` +
    `${mapa.month}-` +
    `${mapa.day}T` +
    `${mapa.hour}:` +
    `${mapa.minute}`
  );
}

function paraInput(
  campo,
  valor
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return (
      campo.padrao ??
      (
        campo.tipo ===
        "booleano"
          ? false
          : ""
      )
    );
  }

  if (
    campo.tipo ===
    "datahora"
  ) {
    return paraDataHoraLocal(
      valor
    );
  }

  if (
    campo.tipo ===
    "data"
  ) {
    return String(
      valor
    ).slice(
      0,
      10
    );
  }

  return valor;
}

export default function GerenciadorCrud({
  recurso,
  config,
}) {
  const [
    itens,
    setItens,
  ] = useState([]);

  const [
    listas,
    setListas,
  ] = useState({});

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    editando,
    setEditando,
  ] = useState(null);

  const [
    erroPagina,
    setErroPagina,
  ] = useState("");

  const [
    busca,
    setBusca,
  ] = useState("");

  const colunas =
    useMemo(
      () =>
        config.campos.filter(
          (campo) =>
            campo.naTabela !==
            false
        ),
      [config]
    );

  async function carregar() {
    setCarregando(true);

    try {
      const resposta =
        await fetch(
          `/api/admin/${recurso}`,
          {
            cache:
              "no-store",
          }
        );

      const dados =
        await lerResposta(
          resposta
        );

      if (!resposta.ok) {
        throw new Error(
          dados.erro ||
          "Não foi possível carregar os dados."
        );
      }

      setItens(
        dados.itens || []
      );
    } catch (e) {
      setItens([]);

      setErroPagina(
        e?.message ||
        "Não foi possível carregar os dados."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function carregarRelacoes() {
    const relacoes =
      config.campos.filter(
        (campo) =>
          campo.tipo ===
          "relacao"
      );

    if (
      relacoes.length ===
      0
    ) {
      setListas({});
      return;
    }

    try {
      const pares =
        await Promise.all(
          relacoes.map(
            async (
              campo
            ) => {
              const resposta =
                await fetch(
                  `/api/admin/${campo.relacao.recurso}`,
                  {
                    cache:
                      "no-store",
                  }
                );

              const dados =
                await lerResposta(
                  resposta
                );

              if (
                !resposta.ok
              ) {
                throw new Error(
                  dados.erro ||
                  `Não foi possível carregar ${campo.rotulo}.`
                );
              }

              return [
                campo.nome,
                dados.itens || [],
              ];
            }
          )
        );

      setListas(
        Object.fromEntries(
          pares
        )
      );
    } catch (e) {
      setListas({});

      setErroPagina(
        e?.message ||
        "Não foi possível carregar os relacionamentos."
      );
    }
  }

  useEffect(() => {
    setEditando(null);
    setBusca("");
    setErroPagina("");

    carregar();
    carregarRelacoes();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurso]);

  async function salvar(
    valores
  ) {
    const novo =
      editando ===
      "novo";

    const url =
      `/api/admin/${recurso}` +
      (
        novo
          ? ""
          : `/${editando.id}`
      );

    try {
      const resposta =
        await fetch(
          url,
          {
            method:
              novo
                ? "POST"
                : "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                valores
              ),
          }
        );

      const dados =
        await lerResposta(
          resposta
        );

      if (
        !resposta.ok
      ) {
        const erro =
          tratarErroSalvar(
            recurso,
            resposta,
            dados
          );

        /*
         * GARANTIA VISUAL:
         *
         * Mesmo que por algum motivo
         * o React não redesenhe a caixa
         * de erro imediatamente,
         * este alerta sempre aparece
         * na frente da tela.
         */
        window.alert(
          `${erro.titulo}\n\n${erro.mensagem}`
        );

        return {
          ok: false,
          titulo:
            erro.titulo,
          mensagem:
            erro.mensagem,
        };
      }

      setEditando(
        null
      );

      await carregar();
      await carregarRelacoes();

      return {
        ok: true,
      };
    } catch (e) {
      const mensagem =
        e?.message ||
        "Não foi possível salvar o registro.";

      window.alert(
        `Não foi possível salvar\n\n${mensagem}`
      );

      return {
        ok: false,
        titulo:
          "Não foi possível salvar",
        mensagem,
      };
    }
  }

  async function excluir(
    item
  ) {
    setErroPagina("");

    const confirmou =
      window.confirm(
        "Excluir definitivamente este registro?"
      );

    if (!confirmou) {
      return;
    }

    try {
      const resposta =
        await fetch(
          `/api/admin/${recurso}/${item.id}`,
          {
            method:
              "DELETE",
          }
        );

      const dados =
        await lerResposta(
          resposta
        );

      if (
        !resposta.ok
      ) {
        setErroPagina(
          dados.erro ||
          "Não foi possível excluir."
        );

        return;
      }

      await carregar();
      await carregarRelacoes();
    } catch (e) {
      setErroPagina(
        e?.message ||
        "Não foi possível excluir."
      );
    }
  }

  const filtrados =
    itens.filter(
      (item) => {
        if (!busca) {
          return true;
        }

        return JSON.stringify(
          item
        )
          .toLowerCase()
          .includes(
            busca.toLowerCase()
          );
      }
    );

  function mostrar(
    campo,
    item
  ) {
    const valor =
      item[
        campo.nome
      ];

    if (
      campo.tipo ===
      "booleano"
    ) {
      return (
        <Etiqueta
          cor={
            valor
              ? "verde"
              : "neutro"
          }
        >
          {valor
            ? "sim"
            : "não"}
        </Etiqueta>
      );
    }

    if (
      valor === null ||
      valor ===
        undefined ||
      valor === ""
    ) {
      return (
        <span className="text-fumaca">
          —
        </span>
      );
    }

    if (
      campo.tipo ===
      "dinheiro"
    ) {
      return (
        <span className="font-mono">
          {dinheiro(
            valor
          )}
        </span>
      );
    }

    if (
      campo.tipo ===
      "datahora"
    ) {
      return (
        <span className="font-mono">
          {dataHora(
            valor
          )}
        </span>
      );
    }

    if (
      campo.tipo ===
      "data"
    ) {
      return (
        <span className="font-mono">
          {mostrarDataSimples(
            valor
          )}
        </span>
      );
    }

    if (
      campo.tipo ===
      "relacao"
    ) {
      const lista =
        listas[
          campo.nome
        ] || [];

      const achado =
        lista.find(
          (
            registro
          ) =>
            registro.id ===
            valor
        );

      return achado ? (
        achado[
          campo.relacao
            .rotulo
        ]
      ) : (
        <span className="text-fumaca">
          —
        </span>
      );
    }

    if (
      campo.tipo ===
      "selecao"
    ) {
      return (
        <Etiqueta cor="couro">
          {valor}
        </Etiqueta>
      );
    }

    return String(
      valor
    );
  }

  function abrirNovo() {
    setErroPagina("");

    setEditando(
      "novo"
    );
  }

  function abrirEditar(
    item
  ) {
    setErroPagina("");

    setEditando(
      item
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-lg text-sm text-fumaca">
          {
            config.descricao
          }
        </p>

        <div className="flex gap-3">
          <input
            value={
              busca
            }
            onChange={(e) =>
              setBusca(
                e.target.value
              )
            }
            placeholder="Buscar..."
            className={`${entradaCls} w-44`}
          />

          <Botao
            onClick={
              abrirNovo
            }
          >
            + Novo{" "}
            {
              config.singular
            }
          </Botao>
        </div>
      </div>

      {erroPagina ? (
        <div className="mb-4 border border-red-800/30 bg-red-50 px-4 py-3 text-sm text-red-900">
          {
            erroPagina
          }
        </div>
      ) : null}

      <div className="overflow-x-auto border border-linha bg-papel shadow-carta">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-linha">
              {colunas.map(
                (
                  campo
                ) => (
                  <th
                    key={
                      campo.nome
                    }
                    className="etiqueta px-4 py-3 text-tinta/50"
                  >
                    {
                      campo.rotulo
                    }
                  </th>
                )
              )}

              <th className="px-4 py-3" />
            </tr>
          </thead>

          <tbody>
            {carregando ? (
              <tr>
                <td
                  colSpan={
                    colunas.length +
                    1
                  }
                  className="px-4 py-10 text-center text-fumaca"
                >
                  Carregando...
                </td>
              </tr>
            ) : null}

            {!carregando &&
            filtrados.length ===
              0 ? (
              <tr>
                <td
                  colSpan={
                    colunas.length +
                    1
                  }
                  className="px-4 py-10 text-center text-fumaca"
                >
                  Nada cadastrado ainda.
                </td>
              </tr>
            ) : null}

            {!carregando &&
              filtrados.map(
                (
                  item
                ) => (
                  <tr
                    key={
                      item.id
                    }
                    className="border-b border-linha/60 last:border-0 hover:bg-marfim/60"
                  >
                    {colunas.map(
                      (
                        campo
                      ) => (
                        <td
                          key={
                            campo.nome
                          }
                          className="px-4 py-3 align-middle"
                        >
                          {mostrar(
                            campo,
                            item
                          )}
                        </td>
                      )
                    )}

                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          abrirEditar(
                            item
                          )
                        }
                        className="etiqueta text-couro hover:underline"
                      >
                        editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          excluir(
                            item
                          )
                        }
                        className="etiqueta ml-4 text-tinta/40 hover:text-red-800"
                      >
                        excluir
                      </button>
                    </td>
                  </tr>
                )
              )}
          </tbody>
        </table>
      </div>

      {editando ? (
        <Formulario
          key={
            editando ===
            "novo"
              ? "novo"
              : editando.id
          }
          config={
            config
          }
          listas={
            listas
          }
          item={
            editando ===
            "novo"
              ? null
              : editando
          }
          aoFechar={() =>
            setEditando(
              null
            )
          }
          aoSalvar={
            salvar
          }
        />
      ) : null}
    </div>
  );
}

function Formulario({
  config,
  item,
  listas,
  aoFechar,
  aoSalvar,
}) {
  const [
    formulario,
    setFormulario,
  ] = useState(
    () =>
      Object.fromEntries(
        config.campos
          .filter(
            (
              campo
            ) =>
              !campo.somenteLeitura
          )
          .map(
            (
              campo
            ) => [
              campo.nome,

              item
                ? paraInput(
                    campo,
                    item[
                      campo.nome
                    ]
                  )
                : (
                    campo.padrao ??
                    (
                      campo.tipo ===
                      "booleano"
                        ? false
                        : ""
                    )
                  ),
            ]
          )
      )
  );

  const [
    salvando,
    setSalvando,
  ] = useState(false);

  const [
    erroFormulario,
    setErroFormulario,
  ] = useState(null);

  const erroRef =
    useRef(null);

  function atualizar(
    campo,
    valor
  ) {
    setErroFormulario(
      null
    );

    setFormulario(
      (
        anterior
      ) => ({
        ...anterior,

        [campo]:
          valor,
      })
    );
  }

  async function enviar(
    e
  ) {
    e.preventDefault();

    if (salvando) {
      return;
    }

    setErroFormulario(
      null
    );

    setSalvando(
      true
    );

    try {
      const resultado =
        await aoSalvar(
          formulario
        );

      if (
        resultado &&
        resultado.ok ===
          false
      ) {
        setErroFormulario({
          titulo:
            resultado.titulo ||
            "Não foi possível salvar",

          mensagem:
            resultado.mensagem ||
            "Não foi possível salvar o registro.",
        });

        window.setTimeout(
          () => {
            if (
              erroRef.current
            ) {
              erroRef.current.scrollIntoView({
                behavior:
                  "smooth",
                block:
                  "center",
              });
            }
          },
          100
        );
      }
    } finally {
      setSalvando(
        false
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinta/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={
          enviar
        }
        className="my-8 w-full max-w-2xl border border-linha bg-papel p-7 shadow-carta"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-3xl capitalize">
            {item
              ? `Editar ${config.singular}`
              : `Novo ${config.singular}`}
          </h2>

          <button
            type="button"
            onClick={
              aoFechar
            }
            disabled={
              salvando
            }
            className="etiqueta text-tinta/50 hover:text-couro disabled:opacity-50"
          >
            fechar
          </button>
        </div>

        {erroFormulario ? (
          <div
            ref={
              erroRef
            }
            role="alert"
            className="mt-6 border-2 border-red-800 bg-red-50 px-5 py-4 text-red-950"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em]">
              {
                erroFormulario.titulo
              }
            </p>

            <p className="mt-2 text-sm leading-relaxed">
              {
                erroFormulario.mensagem
              }
            </p>
          </div>
        ) : null}

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          {config.campos
            .filter(
              (
                campo
              ) =>
                !campo.somenteLeitura
            )
            .map(
              (
                campo
              ) => {
                const valor =
                  formulario[
                    campo.nome
                  ];

                const obrigatorio =
                  Boolean(
                    campo.obrigatorio ||
                    (
                      !item &&
                      campo.obrigatorioAoCriar
                    )
                  );

                const largo =
                  campo.tipo ===
                  "area"
                    ? "sm:col-span-2"
                    : "";

                return (
                  <div
                    key={
                      campo.nome
                    }
                    className={
                      largo
                    }
                  >
                    <Campo
                      rotulo={
                        campo.rotulo
                      }
                      ajuda={
                        campo.ajuda
                      }
                    >
                      {campo.tipo ===
                      "area" ? (
                        <textarea
                          rows={
                            3
                          }
                          value={
                            valor ??
                            ""
                          }
                          required={
                            obrigatorio
                          }
                          disabled={
                            salvando
                          }
                          onChange={(e) =>
                            atualizar(
                              campo.nome,
                              e.target.value
                            )
                          }
                          className={
                            entradaCls
                          }
                        />
                      ) : campo.tipo ===
                        "booleano" ? (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={
                              !!valor
                            }
                            disabled={
                              salvando
                            }
                            onChange={(e) =>
                              atualizar(
                                campo.nome,
                                e.target.checked
                              )
                            }
                          />

                          <span>
                            {valor
                              ? "Sim"
                              : "Não"}
                          </span>
                        </label>
                      ) : campo.tipo ===
                        "selecao" ? (
                        <select
                          value={
                            valor ??
                            ""
                          }
                          required={
                            obrigatorio
                          }
                          disabled={
                            salvando
                          }
                          onChange={(e) =>
                            atualizar(
                              campo.nome,
                              e.target.value
                            )
                          }
                          className={
                            entradaCls
                          }
                        >
                          {!obrigatorio ? (
                            <option value="">
                              Selecione
                            </option>
                          ) : null}

                          {campo.opcoes.map(
                            (
                              opcao
                            ) => (
                              <option
                                key={
                                  opcao
                                }
                                value={
                                  opcao
                                }
                              >
                                {
                                  opcao
                                }
                              </option>
                            )
                          )}
                        </select>
                      ) : campo.tipo ===
                        "relacao" ? (
                        <select
                          value={
                            valor ||
                            ""
                          }
                          required={
                            obrigatorio
                          }
                          disabled={
                            salvando
                          }
                          onChange={(e) =>
                            atualizar(
                              campo.nome,
                              e.target.value
                            )
                          }
                          className={
                            entradaCls
                          }
                        >
                          <option value="">
                            Selecione
                          </option>

                          {(
                            listas[
                              campo.nome
                            ] ||
                            []
                          ).map(
                            (
                              opcao
                            ) => (
                              <option
                                key={
                                  opcao.id
                                }
                                value={
                                  opcao.id
                                }
                              >
                                {
                                  opcao[
                                    campo
                                      .relacao
                                      .rotulo
                                  ]
                                }
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <Entrada
                          type={
                            campo.tipo ===
                            "senha"
                              ? "password"
                              : campo.tipo ===
                                "data"
                              ? "date"
                              : campo.tipo ===
                                "datahora"
                              ? "datetime-local"
                              : (
                                  campo.tipo ===
                                    "numero" ||
                                  campo.tipo ===
                                    "dinheiro" ||
                                  campo.tipo ===
                                    "inteiro"
                                )
                              ? "number"
                              : "text"
                          }
                          step={
                            campo.tipo ===
                            "inteiro"
                              ? "1"
                              : (
                                  campo.tipo ===
                                    "numero" ||
                                  campo.tipo ===
                                    "dinheiro"
                                )
                              ? "0.01"
                              : undefined
                          }
                          value={
                            valor ??
                            ""
                          }
                          required={
                            obrigatorio
                          }
                          disabled={
                            salvando
                          }
                          autoComplete={
                            campo.tipo ===
                            "senha"
                              ? "new-password"
                              : undefined
                          }
                          onChange={(e) =>
                            atualizar(
                              campo.nome,
                              e.target.value
                            )
                          }
                        />
                      )}
                    </Campo>
                  </div>
                );
              }
            )}
        </div>

        <div className="mt-8 flex gap-3">
          <Botao
            type="submit"
            disabled={
              salvando
            }
          >
            {salvando
              ? "Salvando..."
              : "Salvar"}
          </Botao>

          <Botao
            type="button"
            variante="contorno"
            disabled={
              salvando
            }
            onClick={
              aoFechar
            }
          >
            Cancelar
          </Botao>
        </div>
      </form>
    </div>
  );
}