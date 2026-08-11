"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
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

  if (
    !Number.isInteger(convertido) ||
    convertido < 1
  ) {
    return 1;
  }

  return convertido;
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

  const primeiroServico =
    servicos[0] || null;

  const [f, setF] =
    useState({
      tipo: "servico",

      catalogo_id:
        primeiroServico?.id || "",

      descricao:
        primeiroServico?.nome || "",

      valor:
        primeiroServico?.preco ?? "",

      quantidade: 1,

      forma_pagamento:
        "Dinheiro",
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
    itemSelecionado &&
    itemSelecionado.estoque !== undefined &&
    itemSelecionado.estoque !== null
      ? Number(
          itemSelecionado.estoque
        )
      : null;

  const estoqueInsuficiente =
    estoqueSelecionado !== null &&
    quantidade >
      estoqueSelecionado;

  const totalFormulario =
    numero(f.valor) *
    quantidade;

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
            cache: "no-store",
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

  function escolherTipo(tipo) {
    const lista =
      tipo === "servico"
        ? servicos
        : produtos;

    const primeiro =
      lista[0] || null;

    setErro("");

    setF((anterior) => ({
      ...anterior,

      tipo,

      catalogo_id:
        primeiro?.id || "",

      descricao:
        primeiro?.nome || "",

      valor:
        primeiro?.preco ?? "",

      quantidade: 1,
    }));
  }

  function escolherItem(id) {
    const achado =
      catalogo.find(
        (item) =>
          item.id === id
      );

    setErro("");

    setF((anterior) => ({
      ...anterior,

      catalogo_id: id,

      descricao:
        achado?.nome || "",

      valor:
        achado?.preco ?? "",

      quantidade: 1,
    }));
  }

  async function lancar(e) {
    e.preventDefault();

    if (salvando) {
      return;
    }

    setErro("");

    if (!f.catalogo_id) {
      setErro(
        f.tipo === "servico"
          ? "Selecione um serviço."
          : "Selecione um produto."
      );

      return;
    }

    if (!f.descricao.trim()) {
      setErro(
        "Informe a descrição."
      );

      return;
    }

    const valor =
      numero(f.valor);

    if (valor < 0) {
      setErro(
        "Informe um valor válido."
      );

      return;
    }

    if (estoqueInsuficiente) {
      setErro(
        `Estoque insuficiente. Disponível: ${Math.max(
          0,
          estoqueSelecionado
        )}.`
      );

      return;
    }

    setSalvando(true);

    try {
      const corpo = {
        tipo:
          f.tipo,

        descricao:
          f.descricao.trim(),

        valor:
          f.valor,

        quantidade,

        forma_pagamento:
          f.forma_pagamento,

        servico_id:
          f.tipo === "servico"
            ? f.catalogo_id
            : null,

        produto_id:
          f.tipo === "produto"
            ? f.catalogo_id
            : null,
      };

      const resposta =
        await fetch(
          "/api/vendas",
          {
            method: "POST",

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

      if (!resposta.ok) {
        throw new Error(
          dados.erro ||
            "Não foi possível lançar a venda."
        );
      }

      setF((anterior) => ({
        ...anterior,
        quantidade: 1,
      }));

      if (dia !== hoje) {
        setDia(hoje);
      } else {
        await carregar(hoje);
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

  async function apagar(venda) {
    if (apagando) {
      return;
    }

    const qtd =
      quantidadeValida(
        venda.quantidade
      );

    const mensagem =
      venda.tipo === "produto"
        ? `Excluir este lançamento de ${venda.descricao} ×${qtd}?\n\nA quantidade será devolvida automaticamente ao estoque.`
        : `Excluir este lançamento de ${venda.descricao}?`;

    const confirmou =
      window.confirm(
        mensagem
      );

    if (!confirmou) {
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
            method: "DELETE",
          }
        );

      const dados =
        await lerJson(
          resposta
        );

      if (!resposta.ok) {
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
      (soma, venda) =>
        soma +
        numero(venda.valor) *
          quantidadeValida(
            venda.quantidade
          ),
      0
    );

  const porTipo = [
    "servico",
    "produto",
  ].map((tipo) => ({
    tipo,

    total: itens
      .filter(
        (venda) =>
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
              venda.quantidade
            ),
        0
      ),
  }));

  const semItensNoCatalogo =
    catalogo.length === 0;

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
          onSubmit={lancar}
          className="border border-linha bg-papel p-7 shadow-carta"
        >
          <p className="etiqueta text-tinta/45">
            Lançamento rápido
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
            ].map((tipo) => (
              <button
                key={tipo}
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
                  f.tipo === tipo
                    ? "border-couro bg-couro text-marfim"
                    : "border-linha hover:border-couro"
                }`}
              >
                {tipo ===
                "servico"
                  ? "Serviço"
                  : "Produto"}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-5">
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
                    (item) => (
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
              "produto" &&
            estoqueSelecionado !==
              null ? (
              <div className="border border-linha bg-marfim/60 px-4 py-3 text-sm">
                <span className="text-fumaca">
                  Estoque disponível:
                </span>{" "}
                <strong className="font-mono">
                  {Math.max(
                    0,
                    estoqueSelecionado
                  )}
                </strong>
              </div>
            ) : null}

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
                        e.target.value,
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
                  min="0"
                  step="0.01"
                  value={
                    f.valor
                  }
                  onChange={(e) =>
                    setF(
                      (
                        anterior
                      ) => ({
                        ...anterior,

                        valor:
                          e.target.value,
                      })
                    )
                  }
                  required
                  disabled={
                    salvando
                  }
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
                          e.target.value,
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
                        e.target.value,
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
                  (pagamento) => (
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
                Total
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
              semItensNoCatalogo ||
              estoqueInsuficiente
            }
          >
            {salvando
              ? "Lançando..."
              : estoqueInsuficiente
              ? "Estoque insuficiente"
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
              value={dia}
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
                  0 && (
                  <p className="py-6 text-center text-sm text-fumaca">
                    Nenhum lançamento nesse dia.
                  </p>
                )}

              {!carregando &&
                itens.map(
                  (venda) => {
                    const qtd =
                      quantidadeValida(
                        venda.quantidade
                      );

                    const totalVenda =
                      numero(
                        venda.valor
                      ) * qtd;

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

                            {qtd > 1
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
                            className="border border-red-800/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-800 transition hover:bg-red-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
                (grupo) => (
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