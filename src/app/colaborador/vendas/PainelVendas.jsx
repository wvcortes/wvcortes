"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Botao,
  Campo,
  Entrada,
  Aviso,
  entradaCls,
} from "@/components/ui";
import {
  dinheiro,
  hora,
  diaLocal,
} from "@/lib/formato";

const PAGAMENTOS = [
  "Dinheiro",
  "Pix",
  "Débito",
  "Crédito",
];

function numero(valor) {
  const convertido = Number(
    String(valor ?? "").replace(",", ".")
  );

  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function quantidadeValida(valor) {
  const convertido = Number(valor);

  return Number.isInteger(convertido) &&
    convertido >= 1
    ? convertido
    : 1;
}

async function lerJson(resposta) {
  try {
    return await resposta.json();
  } catch {
    return {};
  }
}

export default function PainelVendas({
  servicos = [],
  produtos = [],
  colaboradores = [],
}) {
  const router = useRouter();
  const hoje = diaLocal();

  const [dia, setDia] =
    useState(hoje);

  const [itens, setItens] =
    useState([]);

  const [erro, setErro] =
    useState("");

  const [carregando, setCarregando] =
    useState(true);

  const [salvando, setSalvando] =
    useState(false);

  const [apagando, setApagando] =
    useState("");

  const [
    comandaProdutos,
    setComandaProdutos,
  ] = useState({});

  const primeiroServico =
    servicos[0] || null;

  const [f, setF] =
    useState({
      tipo: "servico",

      catalogo_id:
        primeiroServico?.id || "",

      descricao:
        primeiroServico?.nome || "",

      quantidade: 1,

      forma_pagamento:
        "Dinheiro",

      colaborador_id:
        colaboradores[0]?.id || "",
    });

  const catalogo =
    useMemo(
      () =>
        f.tipo === "servico"
          ? servicos
          : produtos,
      [
        f.tipo,
        servicos,
        produtos,
      ]
    );

  const itemSelecionado =
    useMemo(
      () =>
        catalogo.find(
          (item) =>
            item.id ===
            f.catalogo_id
        ) || null,
      [
        catalogo,
        f.catalogo_id,
      ]
    );

  const quantidade =
    quantidadeValida(
      f.quantidade
    );

  const estoqueSelecionado =
    f.tipo === "produto" &&
    itemSelecionado?.estoque !== undefined &&
    itemSelecionado?.estoque !== null
      ? Number(
          itemSelecionado.estoque
        )
      : null;

  const quantidadeJaNaComanda =
    f.tipo === "produto" &&
    itemSelecionado
      ? Number(
          comandaProdutos[
            itemSelecionado.id
          ] || 0
        )
      : 0;

  const estoqueInsuficiente =
    estoqueSelecionado !== null &&
    quantidadeJaNaComanda +
      quantidade >
      estoqueSelecionado;

  const produtosDaComanda =
    useMemo(
      () =>
        produtos
          .map(
            (produto) => {
              const quantidadeProduto =
                Number(
                  comandaProdutos[
                    produto.id
                  ] || 0
                );

              if (
                quantidadeProduto <
                1
              ) {
                return null;
              }

              return {
                ...produto,

                quantidade:
                  quantidadeProduto,

                subtotal:
                  numero(
                    produto.preco
                  ) *
                  quantidadeProduto,
              };
            }
          )
          .filter(Boolean),
      [
        produtos,
        comandaProdutos,
      ]
    );

  const totalProdutosComanda =
    useMemo(
      () =>
        produtosDaComanda.reduce(
          (
            soma,
            produto
          ) =>
            soma +
            produto.subtotal,
          0
        ),
      [produtosDaComanda]
    );

  const totalServico =
    f.tipo === "servico"
      ? numero(
          itemSelecionado?.preco
        ) *
        quantidade
      : 0;

  const totalFormulario =
    f.tipo === "produto"
      ? totalProdutosComanda
      : totalServico;

  async function carregar(
    data = dia
  ) {
    setCarregando(true);
    setErro("");

    try {
      const resposta =
        await fetch(
          `/api/vendas?data=${encodeURIComponent(
            data
          )}`,
          {
            cache:
              "no-store",
          }
        );

      const dados =
        await lerJson(
          resposta
        );

      if (!resposta.ok) {
        throw new Error(
          dados.erro ||
            "Não foi possível carregar as vendas."
        );
      }

      setItens(
        dados.itens || []
      );
    } catch (e) {
      setItens([]);

      setErro(
        e?.message ||
          "Não foi possível carregar as vendas."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(dia);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia]);

  useEffect(() => {
    setComandaProdutos(
      (anterior) => {
        const proximo = {};

        for (
          const produto
          of produtos
        ) {
          const atual =
            Number(
              anterior[
                produto.id
              ] || 0
            );

          const estoque =
            Math.max(
              0,
              Number(
                produto.estoque ||
                0
              )
            );

          const qtd =
            Math.min(
              atual,
              estoque
            );

          if (qtd > 0) {
            proximo[
              produto.id
            ] =
              qtd;
          }
        }

        return proximo;
      }
    );
  }, [produtos]);

  function escolherTipo(
    tipo
  ) {
    const lista =
      tipo === "servico"
        ? servicos
        : produtos;

    const primeiro =
      lista[0] || null;

    setErro("");

    setF(
      (anterior) => ({
        ...anterior,

        tipo,

        catalogo_id:
          primeiro?.id ||
          "",

        descricao:
          primeiro?.nome ||
          "",

        quantidade: 1,
      })
    );
  }

  function escolherItem(
    id
  ) {
    const achado =
      catalogo.find(
        (item) =>
          item.id === id
      );

    setErro("");

    setF(
      (anterior) => ({
        ...anterior,

        catalogo_id: id,

        descricao:
          achado?.nome ||
          "",

        quantidade: 1,
      })
    );
  }

  function adicionarProduto() {
    setErro("");

    if (
      f.tipo !==
        "produto" ||
      !itemSelecionado
    ) {
      setErro(
        "Selecione um produto."
      );

      return;
    }

    const estoque =
      Number(
        itemSelecionado
          .estoque ?? 0
      );

    const jaNaComanda =
      Number(
        comandaProdutos[
          itemSelecionado.id
        ] || 0
      );

    if (
      !Number.isFinite(
        estoque
      ) ||
      estoque < 1
    ) {
      setErro(
        "Esse produto está sem estoque."
      );

      return;
    }

    if (
      jaNaComanda +
        quantidade >
      estoque
    ) {
      setErro(
        `Estoque insuficiente. Disponível: ${Math.max(
          0,
          estoque -
            jaNaComanda
        )}.`
      );

      return;
    }

    setComandaProdutos(
      (anterior) => ({
        ...anterior,

        [itemSelecionado.id]:
          Number(
            anterior[
              itemSelecionado
                .id
            ] || 0
          ) +
          quantidade,
      })
    );

    setF(
      (anterior) => ({
        ...anterior,
        quantidade: 1,
      })
    );
  }

  function alterarQuantidadeComanda(
    produto,
    novaQuantidade
  ) {
    setErro("");

    const estoque =
      Math.max(
        0,
        Number(
          produto.estoque ||
          0
        )
      );

    const qtd =
      Number(
        novaQuantidade
      );

    if (
      !Number.isInteger(
        qtd
      )
    ) {
      return;
    }

    if (qtd <= 0) {
      removerProdutoComanda(
        produto.id
      );

      return;
    }

    if (qtd > estoque) {
      setErro(
        `Estoque insuficiente para ${produto.nome}. Disponível: ${estoque}.`
      );

      return;
    }

    setComandaProdutos(
      (anterior) => ({
        ...anterior,

        [produto.id]:
          qtd,
      })
    );
  }

  function removerProdutoComanda(
    produtoId
  ) {
    setErro("");

    setComandaProdutos(
      (anterior) => {
        const proximo = {
          ...anterior,
        };

        delete proximo[
          produtoId
        ];

        return proximo;
      }
    );
  }

  async function lancar(
    e
  ) {
    e.preventDefault();

    if (salvando) {
      return;
    }

    setErro("");

    if (
      colaboradores.length >
        0 &&
      !f.colaborador_id
    ) {
      setErro(
        "Selecione o profissional responsável."
      );

      return;
    }

    let corpo;

    if (
      f.tipo ===
      "produto"
    ) {
      if (
        !produtosDaComanda
          .length
      ) {
        setErro(
          "Adicione pelo menos um produto à comanda."
        );

        return;
      }

      corpo = {
        tipo:
          "produto",

        forma_pagamento:
          f.forma_pagamento,

        colaborador_id:
          f.colaborador_id ||
          undefined,

        itens:
          produtosDaComanda
            .map(
              (
                produto
              ) => ({
                produto_id:
                  produto.id,

                quantidade:
                  produto
                    .quantidade,
              })
            ),
      };
    } else {
      if (
        !f.catalogo_id
      ) {
        setErro(
          "Selecione um serviço."
        );

        return;
      }

      if (
        !f.descricao.trim()
      ) {
        setErro(
          "Informe a descrição."
        );

        return;
      }

      corpo = {
        tipo:
          "servico",

        descricao:
          f.descricao.trim(),

        quantidade,

        forma_pagamento:
          f.forma_pagamento,

        colaborador_id:
          f.colaborador_id ||
          undefined,

        servico_id:
          f.catalogo_id,

        produto_id:
          null,
      };
    }

    setSalvando(true);

    try {
      const resposta =
        await fetch(
          "/api/vendas",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                corpo
              ),
          }
        );

      const dados =
        await lerJson(
          resposta
        );

      if (
        !resposta.ok
      ) {
        throw new Error(
          dados.erro ||
            "Não foi possível lançar a venda."
        );
      }

      if (
        f.tipo ===
        "produto"
      ) {
        setComandaProdutos(
          {}
        );
      }

      setF(
        (anterior) => ({
          ...anterior,
          quantidade: 1,
        })
      );

      if (
        dia !== hoje
      ) {
        setDia(hoje);
      } else {
        await carregar(
          hoje
        );
      }

      router.refresh();
    } catch (e) {
      setErro(
        e?.message ||
          "Não foi possível lançar a venda."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(
    venda
  ) {
    if (apagando) {
      return;
    }

    const qtd =
      quantidadeValida(
        venda.quantidade
      );

    const mensagem =
      venda.tipo ===
      "produto"
        ? `Excluir este lançamento de ${venda.descricao} ×${qtd}?\n\nA quantidade será devolvida automaticamente ao estoque.`
        : `Excluir este lançamento de ${venda.descricao}?`;

    if (
      !window.confirm(
        mensagem
      )
    ) {
      return;
    }

    setErro("");

    setApagando(
      venda.id
    );

    try {
      const resposta =
        await fetch(
          `/api/vendas?id=${encodeURIComponent(
            venda.id
          )}`,
          {
            method:
              "DELETE",
          }
        );

      const dados =
        await lerJson(
          resposta
        );

      if (
        !resposta.ok
      ) {
        throw new Error(
          dados.erro ||
            "Não foi possível excluir o lançamento."
        );
      }

      await carregar(dia);

      router.refresh();
    } catch (e) {
      setErro(
        e?.message ||
          "Não foi possível excluir o lançamento."
      );
    } finally {
      setApagando("");
    }
  }

  const total =
    itens.reduce(
      (
        soma,
        venda
      ) =>
        soma +
        numero(
          venda.valor
        ) *
          quantidadeValida(
            venda.quantidade
          ),
      0
    );

  const porTipo =
    [
      "servico",
      "produto",
    ].map(
      (tipo) => ({
        tipo,

        total:
          itens
            .filter(
              (
                venda
              ) =>
                venda.tipo ===
                tipo
            )
            .reduce(
              (
                soma,
                venda
              ) =>
                soma +
                numero(
                  venda.valor
                ) *
                  quantidadeValida(
                    venda
                      .quantidade
                  ),
              0
            ),
      })
    );

  const semItensNoCatalogo =
    catalogo.length ===
    0;

  return (
    <>
      <p className="etiqueta text-couro">
        Vendas
      </p>

      <h1 className="mt-3 font-display text-4xl">
        O que saiu da minha cadeira
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <form
          onSubmit={
            lancar
          }
          className="border border-linha bg-papel p-7 shadow-carta"
        >
          <p className="etiqueta text-tinta/45">
            {f.tipo ===
            "produto"
              ? "Comanda de produtos"
              : "Lançamento rápido"}
          </p>

          {erro ? (
            <div className="mt-4">
              <Aviso>
                {erro}
              </Aviso>
            </div>
          ) : null}

          <div className="mt-5 flex gap-2">
            {[
              "servico",
              "produto",
            ].map(
              (
                tipo
              ) => (
                <button
                  key={
                    tipo
                  }
                  type="button"
                  onClick={() =>
                    escolherTipo(
                      tipo
                    )
                  }
                  disabled={
                    salvando
                  }
                  className={`flex-1 border px-4 py-2.5 text-sm capitalize disabled:opacity-50 ${
                    f.tipo ===
                    tipo
                      ? "border-couro bg-couro text-marfim"
                      : "border-linha hover:border-couro"
                  }`}
                >
                  {tipo ===
                  "servico"
                    ? "Serviço"
                    : "Produto"}
                </button>
              )
            )}
          </div>

          <div className="mt-5 space-y-5">
            {colaboradores.length >
            0 ? (
              <Campo rotulo="Profissional responsável">
                <select
                  value={
                    f.colaborador_id
                  }
                  onChange={(e) =>
                    setF(
                      (
                        anterior
                      ) => ({
                        ...anterior,

                        colaborador_id:
                          e
                            .target
                            .value,
                      })
                    )
                  }
                  className={
                    entradaCls
                  }
                  required
                  disabled={
                    salvando
                  }
                >
                  {colaboradores.map(
                    (
                      colaborador
                    ) => (
                      <option
                        key={
                          colaborador.id
                        }
                        value={
                          colaborador.id
                        }
                      >
                        {
                          colaborador.nome
                        }
                      </option>
                    )
                  )}
                </select>
              </Campo>
            ) : null}

            <Campo
              rotulo={
                f.tipo ===
                "servico"
                  ? "Serviço"
                  : "Produto"
              }
            >
              <select
                value={
                  f.catalogo_id
                }
                onChange={(e) =>
                  escolherItem(
                    e.target.value
                  )
                }
                className={
                  entradaCls
                }
                required
                disabled={
                  salvando ||
                  semItensNoCatalogo
                }
              >
                {semItensNoCatalogo ? (
                  <option value="">
                    Nenhum item disponível
                  </option>
                ) : (
                  catalogo.map(
                    (
                      item
                    ) => (
                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.nome} —{" "}
                        {dinheiro(
                          item.preco
                        )}
                        {f.tipo ===
                          "produto" &&
                        item.estoque !==
                          undefined
                          ? ` — estoque: ${item.estoque}`
                          : ""}
                      </option>
                    )
                  )
                )}
              </select>
            </Campo>

            {f.tipo ===
            "produto" ? (
              <>
                {estoqueSelecionado !==
                null ? (
                  <div className="border border-linha bg-marfim/60 px-4 py-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-fumaca">
                        Estoque disponível
                      </span>

                      <strong className="font-mono">
                        {Math.max(
                          0,
                          estoqueSelecionado
                        )}
                      </strong>
                    </div>

                    {quantidadeJaNaComanda >
                    0 ? (
                      <div className="mt-2 flex justify-between gap-2 border-t border-linha pt-2">
                        <span className="text-fumaca">
                          Já na comanda
                        </span>

                        <strong className="font-mono">
                          {
                            quantidadeJaNaComanda
                          }
                        </strong>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4">
                  <Campo rotulo="Valor unitário (R$)">
                    <Entrada
                      type="number"
                      value={
                        itemSelecionado
                          ?.preco ??
                        ""
                      }
                      readOnly
                      disabled
                    />
                  </Campo>

                  <Campo rotulo="Quantidade para adicionar">
                    <Entrada
                      type="number"
                      min="1"
                      step="1"
                      value={
                        f.quantidade
                      }
                      onChange={(e) =>
                        setF(
                          (
                            anterior
                          ) => ({
                            ...anterior,

                            quantidade:
                              e
                                .target
                                .value,
                          })
                        )
                      }
                      required
                      disabled={
                        salvando
                      }
                    />
                  </Campo>
                </div>

                <Botao
                  type="button"
                  className="w-full"
                  disabled={
                    salvando ||
                    semItensNoCatalogo ||
                    estoqueInsuficiente ||
                    estoqueSelecionado ===
                      0
                  }
                  onClick={
                    adicionarProduto
                  }
                >
                  {estoqueInsuficiente
                    ? "Estoque insuficiente"
                    : "Adicionar à comanda"}
                </Botao>

                <div className="border-t border-dashed border-linha pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="etiqueta text-tinta/45">
                      Produtos da comanda
                    </p>

                    <span className="text-xs text-fumaca">
                      {
                        produtosDaComanda.length
                      }{" "}
                      produto(s)
                    </span>
                  </div>

                  {produtosDaComanda.length ===
                  0 ? (
                    <p className="mt-4 text-sm text-fumaca">
                      Nenhum produto adicionado.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {produtosDaComanda.map(
                        (
                          produto
                        ) => (
                          <div
                            key={
                              produto.id
                            }
                            className="border border-linha p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">
                                  {
                                    produto.nome
                                  }
                                </p>

                                <p className="mt-1 text-xs text-fumaca">
                                  {dinheiro(
                                    produto.preco
                                  )}{" "}
                                  cada
                                </p>
                              </div>

                              <strong className="font-mono text-sm text-couro">
                                {dinheiro(
                                  produto.subtotal
                                )}
                              </strong>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    alterarQuantidadeComanda(
                                      produto,
                                      produto.quantidade -
                                        1
                                    )
                                  }
                                  className="flex h-9 w-9 items-center justify-center border border-linha hover:border-couro"
                                >
                                  −
                                </button>

                                <span className="min-w-8 text-center font-mono">
                                  {
                                    produto.quantidade
                                  }
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    alterarQuantidadeComanda(
                                      produto,
                                      produto.quantidade +
                                        1
                                    )
                                  }
                                  disabled={
                                    produto.quantidade >=
                                    Number(
                                      produto.estoque ||
                                        0
                                    )
                                  }
                                  className="flex h-9 w-9 items-center justify-center border border-linha hover:border-couro disabled:opacity-40"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removerProdutoComanda(
                                    produto.id
                                  )
                                }
                                className="text-xs font-semibold text-red-800 hover:underline"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Campo
                  rotulo="Descrição"
                  ajuda="Pode ajustar, por exemplo: corte + sobrancelha."
                >
                  <Entrada
                    value={
                      f.descricao
                    }
                    onChange={(e) =>
                      setF(
                        (
                          anterior
                        ) => ({
                          ...anterior,

                          descricao:
                            e
                              .target
                              .value,
                        })
                      )
                    }
                    required
                    disabled={
                      salvando
                    }
                  />
                </Campo>

                <div className="grid grid-cols-2 gap-4">
                  <Campo rotulo="Valor unitário (R$)">
                    <Entrada
                      type="number"
                      value={
                        itemSelecionado
                          ?.preco ??
                        ""
                      }
                      readOnly
                      disabled
                    />
                  </Campo>

                  <Campo rotulo="Quantidade">
                    <Entrada
                      type="number"
                      min="1"
                      step="1"
                      value={
                        f.quantidade
                      }
                      onChange={(e) =>
                        setF(
                          (
                            anterior
                          ) => ({
                            ...anterior,

                            quantidade:
                              e
                                .target
                                .value,
                          })
                        )
                      }
                      required
                      disabled={
                        salvando
                      }
                    />
                  </Campo>
                </div>
              </>
            )}

            <Campo rotulo="Pagamento">
              <select
                value={
                  f.forma_pagamento
                }
                onChange={(e) =>
                  setF(
                    (
                      anterior
                    ) => ({
                      ...anterior,

                      forma_pagamento:
                        e
                          .target
                          .value,
                    })
                  )
                }
                className={
                  entradaCls
                }
                disabled={
                  salvando
                }
              >
                {PAGAMENTOS.map(
                  (
                    pagamento
                  ) => (
                    <option
                      key={
                        pagamento
                      }
                      value={
                        pagamento
                      }
                    >
                      {
                        pagamento
                      }
                    </option>
                  )
                )}
              </select>
            </Campo>

            <div className="flex items-center justify-between border-t border-dashed border-linha pt-4">
              <span className="text-sm text-fumaca">
                {f.tipo ===
                "produto"
                  ? "Total da comanda"
                  : "Total"}
              </span>

              <span className="font-mono text-lg font-semibold text-couro">
                {dinheiro(
                  totalFormulario
                )}
              </span>
            </div>
          </div>

          <Botao
            type="submit"
            className="mt-7 w-full"
            disabled={
              salvando ||
              (f.tipo ===
                "servico" &&
                semItensNoCatalogo) ||
              (f.tipo ===
                "produto" &&
                produtosDaComanda.length ===
                  0)
            }
          >
            {salvando
              ? "Lançando..."
              : f.tipo ===
                "produto"
              ? "Lançar comanda"
              : "Lançar venda"}
          </Botao>
        </form>

        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="etiqueta text-tinta/45">
              Comanda do dia
            </p>

            <input
              type="date"
              value={
                dia
              }
              onChange={(e) =>
                setDia(
                  e.target.value
                )
              }
              className={`${entradaCls} w-44`}
            />
          </div>

          <div className="papel-recibo border border-linha p-6 shadow-carta">
            <div className="space-y-4">
              {carregando ? (
                <p className="py-6 text-center text-sm text-fumaca">
                  Carregando...
                </p>
              ) : null}

              {!carregando &&
              itens.length ===
                0 ? (
                <p className="py-6 text-center text-sm text-fumaca">
                  Nenhum lançamento nesse dia.
                </p>
              ) : null}

              {!carregando &&
                itens.map(
                  (
                    venda
                  ) => {
                    const qtd =
                      quantidadeValida(
                        venda.quantidade
                      );

                    const totalVenda =
                      numero(
                        venda.valor
                      ) *
                      qtd;

                    return (
                      <div
                        key={
                          venda.id
                        }
                        className="border-b border-dashed border-tinta/15 pb-4 last:border-0 last:pb-0"
                      >
                        <div className="linha-preco">
                          <span className="font-mono text-xs text-fumaca">
                            {hora(
                              venda.criado_em
                            )}
                          </span>

                          <span>
                            {
                              venda.descricao
                            }

                            {qtd >
                            1
                              ? ` ×${qtd}`
                              : ""}
                          </span>

                          <span className="pontos" />

                          <span className="font-mono text-sm">
                            {dinheiro(
                              totalVenda
                            )}
                          </span>
                        </div>

                        <div className="ml-12 mt-2 flex items-center justify-between gap-3">
                          <p className="text-[11px] text-fumaca">
                            {
                              venda.forma_pagamento
                            }
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              apagar(
                                venda
                              )
                            }
                            disabled={
                              apagando ===
                              venda.id
                            }
                            className="border border-red-800/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-800 transition hover:bg-red-800 hover:text-white disabled:opacity-40"
                          >
                            {apagando ===
                            venda.id
                              ? "Excluindo..."
                              : "Excluir lançamento"}
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
            </div>

            <div className="mt-6 space-y-2 border-t border-dashed border-tinta/25 pt-4">
              {porTipo.map(
                (
                  grupo
                ) => (
                  <div
                    key={
                      grupo.tipo
                    }
                    className="linha-preco text-sm"
                  >
                    <span className="capitalize text-fumaca">
                      {grupo.tipo ===
                      "servico"
                        ? "Serviços"
                        : "Produtos"}
                    </span>

                    <span className="pontos" />

                    <span className="font-mono">
                      {dinheiro(
                        grupo.total
                      )}
                    </span>
                  </div>
                )
              )}

              <div className="linha-preco pt-2 font-semibold">
                <span>
                  Total do dia
                </span>

                <span className="pontos" />

                <span className="font-mono text-couro">
                  {dinheiro(
                    total
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}