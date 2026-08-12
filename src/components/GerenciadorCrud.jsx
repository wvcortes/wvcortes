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

  const [lixeira, setLixeira] = useState(false);

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
          `/api/admin/${recurso}${recurso === "equipe" && lixeira ? "?lixeira=1" : ""}`,
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
  }, [recurso, lixeira]);

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

      if (recurso === "equipe" && !novo && editando.foto_url && editando.foto_url !== valores.foto_url) {
        await fetch("/api/admin/equipe/foto", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: editando.foto_url }),
        }).catch(() => null);
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

    const confirmou = window.confirm(
      recurso === "equipe"
        ? "EXCLUIR COLABORADOR?\n\nEste colaborador poderá ser recuperado durante as próximas 24 horas.\n\nSe houver registros financeiros ou valores pendentes, eles serão preservados."
        : "Excluir definitivamente este registro?"
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

  async function acaoEquipe(item, acao) {
    setErroPagina("");
    const resposta = await fetch(`/api/admin/equipe/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao }),
    });
    const dados = await lerResposta(resposta);
    if (!resposta.ok) return setErroPagina(dados.erro || "Não foi possível concluir a ação.");
    await carregar();
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
          {recurso === "equipe" ? (valor ? "ATIVO" : "INATIVO") : (valor ? "sim" : "não")}
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
          {recurso === "equipe" ? (
            <Botao variante="contorno" onClick={() => setLixeira((valor) => !valor)}>
              {lixeira ? "Voltar à equipe" : "Lixeira"}
            </Botao>
          ) : null}
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

          {!lixeira ? <Botao
            onClick={
              abrirNovo
            }
          >
            + Novo{" "}
            {
              config.singular
            }
          </Botao> : null}
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
                          {recurso === "equipe" && lixeira && campo.nome === "nome" ? (
                            <div className="flex items-center gap-3">
                              {item.foto_url ? <img src={item.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-marfim">{item.nome?.[0]}</span>}
                              <span>{item.nome}</span>
                            </div>
                          ) : mostrar(campo, item)}
                        </td>
                      )
                    )}

                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {recurso === "equipe" && lixeira ? (
                        <>
                          <span className="mr-4 block text-xs text-fumaca">Excluído em {dataHora(item.excluido_em)} por {item.excluido_por_nome || "administrador"}</span>
                          <span className="mr-4 text-xs text-fumaca">
                            {Math.max(0, Math.ceil((new Date(item.excluido_em).getTime() + 86400000 - Date.now()) / 3600000))}h restantes
                          </span>
                          <button type="button" onClick={() => acaoEquipe(item, "restaurar")} className="etiqueta text-couro hover:underline">restaurar</button>
                        </>
                      ) : <>
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
                      {recurso === "equipe" ? (
                        <button type="button" onClick={() => acaoEquipe(item, item.ativo ? "desativar" : "reativar")} className="etiqueta ml-4 text-tinta/60 hover:text-couro">
                          {item.ativo ? "desativar" : "reativar"}
                        </button>
                      ) : null}
                      </>}
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
                      {campo.tipo === "arquivo_imagem" ? (
                        <UploadFoto valor={valor} disabled={salvando} aoAlterar={(url) => atualizar(campo.nome, url)} />
                      ) : campo.tipo ===
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

        {config.titulo === "Unidades WV Cortes" ? (
          <SeletorMapa
            latitude={formulario.latitude}
            longitude={formulario.longitude}
            raio={formulario.raio_ponto_m}
            aoAlterar={(latitude, longitude) => setFormulario((anterior) => ({ ...anterior, latitude, longitude }))}
          />
        ) : null}

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

function UploadFoto({ valor, aoAlterar, disabled }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  async function escolher(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) return setErro("Use JPG, JPEG, PNG ou WEBP.");
    if (arquivo.size > 5 * 1024 * 1024) return setErro("A foto deve ter no máximo 5 MB.");
    setErro("");
    setEnviando(true);
    const form = new FormData();
    form.set("foto", arquivo);
    const resposta = await fetch("/api/admin/equipe/foto", { method: "POST", body: form });
    const dados = await lerResposta(resposta);
    setEnviando(false);
    if (!resposta.ok) return setErro(dados.erro || "Não foi possível enviar a foto.");
    aoAlterar(dados.url);
  }
  return <div className="space-y-3">
    {valor ? <img src={valor} alt="Prévia da foto do colaborador" className="h-32 w-32 rounded-full object-cover" /> : <div className="flex h-32 w-32 items-center justify-center rounded-full bg-marfim text-sm text-fumaca">Sem foto</div>}
    <div className="flex flex-wrap gap-2">
      <label className="cursor-pointer rounded-xl border border-linha px-4 py-3 text-sm font-bold hover:bg-marfim">
        {enviando ? "Enviando..." : valor ? "Trocar foto" : "Escolher arquivo"}
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || enviando} onChange={escolher} />
      </label>
      {valor ? <button type="button" className="rounded-xl border border-linha px-4 py-3 text-sm" disabled={disabled || enviando} onClick={() => aoAlterar("")}>Remover foto</button> : null}
    </div>
    <p className="text-xs text-fumaca">JPG, JPEG, PNG ou WEBP. Máximo de 5 MB.</p>
    {erro ? <p className="text-sm text-red-800">{erro}</p> : null}
  </div>;
}

function SeletorMapa({ latitude, longitude, raio, aoAlterar }) {
  const [aberto, setAberto] = useState(false);
  const [precisao, setPrecisao] = useState(null);
  const [erro, setErro] = useState("");
  const mapaRef = useRef(null);
  const instanciaRef = useRef(null);
  const marcadorRef = useRef(null);
  const circuloRef = useRef(null);
  const coordenadaRef = useRef(null);

  useEffect(() => {
    if (!aberto || typeof window === "undefined") return;
    let cancelado = false;
    async function carregarLeaflet() {
      if (!document.querySelector('link[data-wv-leaflet]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.wvLeaflet = "1";
        document.head.appendChild(link);
      }
      if (!window.L) await new Promise((resolve, reject) => {
        const existente = document.querySelector('script[data-wv-leaflet]');
        if (existente) { existente.addEventListener("load", resolve, { once: true }); existente.addEventListener("error", reject, { once: true }); return; }
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.dataset.wvLeaflet = "1";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      if (cancelado || instanciaRef.current || !mapaRef.current) return;
      const L = window.L;
      const lat = Number(latitude), lng = Number(longitude);
      const tem = latitude !== "" && latitude != null && longitude !== "" && longitude != null && Number.isFinite(lat) && Number.isFinite(lng);
      const centro = tem ? [lat, lng] : [-23.55052, -46.633308];
      const mapa = L.map(mapaRef.current, { tap: true }).setView(centro, tem ? 18 : 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "&copy; OpenStreetMap" }).addTo(mapa);
      function posicionar(ponto) {
        coordenadaRef.current = ponto;
        if (!marcadorRef.current) {
          marcadorRef.current = L.marker(ponto, { draggable: true }).addTo(mapa).bindTooltip("LOCALIZAÇÃO DA UNIDADE", { permanent: true, direction: "top" });
          marcadorRef.current.on("drag", (e) => posicionar(e.target.getLatLng()));
        } else marcadorRef.current.setLatLng(ponto);
        if (!circuloRef.current) circuloRef.current = L.circle(ponto, { radius: Number(raio) || 100, color: "#c96f32", fillOpacity: 0.15 }).addTo(mapa);
        else circuloRef.current.setLatLng(ponto);
      }
      if (tem) posicionar(L.latLng(lat, lng));
      mapa.on("click", (e) => posicionar(e.latlng));
      instanciaRef.current = mapa;
      setTimeout(() => mapa.invalidateSize(), 0);
    }
    carregarLeaflet().catch(() => setErro("Não foi possível carregar o mapa. Verifique sua conexão."));
    return () => { cancelado = true; if (instanciaRef.current) instanciaRef.current.remove(); instanciaRef.current = null; marcadorRef.current = null; circuloRef.current = null; };
  }, [aberto]);

  useEffect(() => { if (circuloRef.current) circuloRef.current.setRadius(Math.max(1, Number(raio) || 100)); }, [raio]);

  function localizacaoAtual() {
    if (!navigator.geolocation) return setErro("Geolocalização não disponível neste aparelho.");
    navigator.geolocation.getCurrentPosition((pos) => {
      setPrecisao(pos.coords.accuracy);
      const ponto = window.L?.latLng(pos.coords.latitude, pos.coords.longitude);
      if (ponto && instanciaRef.current) {
        coordenadaRef.current = ponto;
        if (!marcadorRef.current) {
          marcadorRef.current = window.L.marker(ponto, { draggable: true }).addTo(instanciaRef.current).bindTooltip("LOCALIZAÇÃO DA UNIDADE", { permanent: true, direction: "top" });
          marcadorRef.current.on("drag", (e) => {
            coordenadaRef.current = e.target.getLatLng();
            circuloRef.current?.setLatLng(coordenadaRef.current);
          });
        }
        else marcadorRef.current.setLatLng(ponto);
        if (!circuloRef.current) circuloRef.current = window.L.circle(ponto, { radius: Number(raio) || 100, color: "#c96f32", fillOpacity: .15 }).addTo(instanciaRef.current);
        else circuloRef.current.setLatLng(ponto);
        instanciaRef.current.setView(ponto, 18);
      }
    }, () => setErro("Não foi possível obter sua localização. Confira a permissão do navegador."), { enableHighAccuracy: true, timeout: 15000 });
  }

  function confirmar() {
    if (!coordenadaRef.current) return setErro("Clique no mapa para posicionar o pin.");
    aoAlterar(Number(coordenadaRef.current.lat.toFixed(7)), Number(coordenadaRef.current.lng.toFixed(7)));
    setAberto(false);
  }

  return <div className="mt-6 border border-linha bg-marfim/40 p-4 sm:col-span-2">
    <p className="font-bold">Localização da unidade</p>
    <p className="mt-1 text-sm text-fumaca">O círculo mostra até onde o ponto será considerado dentro da unidade.</p>
    <div className="mt-3 flex flex-wrap gap-3">
      <Botao type="button" variante="contorno" onClick={() => setAberto((v) => !v)}>Selecionar no mapa</Botao>
      {aberto ? <Botao type="button" variante="contorno" onClick={localizacaoAtual}>Usar minha localização atual</Botao> : null}
    </div>
    {precisao != null ? <p className={`mt-3 text-sm ${precisao > 50 ? "text-amber-800" : "text-fumaca"}`}>Precisão atual: {Math.round(precisao)} m{precisao > 50 ? " — sinal impreciso; ajuste o pin antes de confirmar." : ""}</p> : null}
    {erro ? <p className="mt-3 text-sm text-red-800">{erro}</p> : null}
    {aberto ? <div className="mt-4">
      <div ref={mapaRef} className="h-[55vh] min-h-[320px] w-full touch-pan-x touch-pan-y bg-[#ddd]" aria-label="Mapa para selecionar a localização da unidade" />
      <button type="button" onClick={confirmar} className="mt-4 min-h-12 w-full rounded-xl bg-[#c96f32] px-5 font-bold text-[#09100d]">Confirmar localização</button>
    </div> : null}
  </div>;
}
