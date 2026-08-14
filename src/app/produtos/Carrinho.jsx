"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  dinheiro,
} from "@/lib/formato";

import {
  Botao,
  Entrada,
  Aviso,
} from "@/components/ui";

function estoqueDoProduto(produto) {
  const estoque =
    Number(produto?.estoque);

  if (
    !Number.isFinite(estoque) ||
    estoque < 0
  ) {
    return 0;
  }

  return Math.floor(estoque);
}

export default function Carrinho({
  produtos = [],
}) {
  /**
   * Estrutura:
   *
   * {
   *   produtoId1: 2,
   *   produtoId2: 1,
   *   produtoId3: 4
   * }
   *
   * Dessa forma vários produtos diferentes
   * podem permanecer no carrinho ao mesmo tempo.
   */
  const [
    carrinho,
    setCarrinho,
  ] = useState({});

  const [
    nome,
    setNome,
  ] = useState("");

  const [
    resultado,
    setResultado,
  ] = useState(null);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    preparando,
    setPreparando,
  ] = useState(false);

  const itens =
    useMemo(
      () =>
        produtos
          .map(
            (produto) => {
              const quantidade =
                Number(
                  carrinho[
                    produto.id
                  ] || 0
                );

              if (
                quantidade <= 0
              ) {
                return null;
              }

              const preco =
                Number(
                  produto.preco ||
                  0
                );

              return {
                ...produto,

                quantidade,

                subtotal:
                  preco *
                  quantidade,
              };
            }
          )
          .filter(Boolean),
      [
        carrinho,
        produtos,
      ]
    );

  const total =
    useMemo(
      () =>
        itens.reduce(
          (
            soma,
            item
          ) =>
            soma +
            Number(
              item.subtotal ||
              0
            ),
          0
        ),
      [itens]
    );

  const quantidadeTotal =
    useMemo(
      () =>
        itens.reduce(
          (
            soma,
            item
          ) =>
            soma +
            item.quantidade,
          0
        ),
      [itens]
    );

  function limparResultados() {
    setResultado(null);
    setErro("");
  }

  function definirQuantidade(
    produto,
    quantidadeDesejada
  ) {
    limparResultados();

    const estoque =
      estoqueDoProduto(
        produto
      );

    let quantidade =
      Number(
        quantidadeDesejada
      );

    if (
      !Number.isFinite(
        quantidade
      )
    ) {
      quantidade = 0;
    }

    quantidade =
      Math.floor(
        quantidade
      );

    if (
      quantidade < 0
    ) {
      quantidade = 0;
    }

    if (
      quantidade >
      estoque
    ) {
      setErro(
        `Só existem ${estoque} unidade(s) de ${produto.nome} disponível(is).`
      );

      quantidade =
        estoque;
    }

    setCarrinho(
      (atual) => {
        const proximo = {
          ...atual,
        };

        if (
          quantidade <= 0
        ) {
          delete proximo[
            produto.id
          ];
        } else {
          proximo[
            produto.id
          ] =
            quantidade;
        }

        return proximo;
      }
    );
  }

  function adicionar(
    produto
  ) {
    limparResultados();

    const estoque =
      estoqueDoProduto(
        produto
      );

    const atual =
      Number(
        carrinho[
          produto.id
        ] || 0
      );

    if (
      estoque <= 0
    ) {
      setErro(
        `${produto.nome} está indisponível no momento.`
      );

      return;
    }

    if (
      atual >= estoque
    ) {
      setErro(
        `Você já adicionou o estoque máximo disponível de ${produto.nome}.`
      );

      return;
    }

    /**
     * IMPORTANTE:
     * espalhamos o carrinho anterior.
     *
     * Isso mantém os outros produtos
     * que já estavam adicionados.
     */
    setCarrinho(
      (anterior) => ({
        ...anterior,

        [produto.id]:
          Number(
            anterior[
              produto.id
            ] || 0
          ) + 1,
      })
    );
  }

  function diminuir(
    produto
  ) {
    const atual =
      Number(
        carrinho[
          produto.id
        ] || 0
      );

    definirQuantidade(
      produto,
      atual - 1
    );
  }

  function aumentar(
    produto
  ) {
    const atual =
      Number(
        carrinho[
          produto.id
        ] || 0
      );

    definirQuantidade(
      produto,
      atual + 1
    );
  }

  function remover(
    produto
  ) {
    definirQuantidade(
      produto,
      0
    );
  }

  function limparCarrinho() {
    setCarrinho({});
    setResultado(null);
    setErro("");
  }

  async function checkout() {
    if (
      itens.length === 0 ||
      preparando
    ) {
      return;
    }

    setErro("");
    setResultado(null);
    setPreparando(true);

    try {
      const resposta =
        await fetch(
          "/api/checkout",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                nome,

                itens:
                  itens.map(
                    (item) => ({
                      id:
                        item.id,

                      quantidade:
                        item.quantidade,
                    })
                  ),
              }),
          }
        );

      const dados =
        await resposta
          .json()
          .catch(
            () => ({})
          );

      if (
        !resposta.ok
      ) {
        setErro(
          dados.erro ||
            "Não foi possível preparar o pedido."
        );

        return;
      }

      setResultado(
        dados
      );
    } catch {
      setErro(
        "Não foi possível preparar o pedido. Verifique sua conexão e tente novamente."
      );
    } finally {
      setPreparando(false);
    }
  }

  async function copiarPix() {
    if (
      !resultado?.pix
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        resultado.pix
      );
    } catch {
      setErro(
        "Não foi possível copiar o Pix automaticamente."
      );
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section>
        {produtos.length ===
        0 ? (
          <div className="border border-linha bg-papel p-8 text-center">
            <p className="text-fumaca">
              Nenhum produto
              disponível no
              momento.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {produtos.map(
              (produto) => {
                const estoque =
                  estoqueDoProduto(
                    produto
                  );

                const quantidade =
                  Number(
                    carrinho[
                      produto.id
                    ] || 0
                  );

                const noCarrinho =
                  quantidade > 0;

                return (
                  <article
                    key={
                      produto.id
                    }
                    className="barber-card card-premium flex flex-col overflow-hidden p-5"
                  >
                    {produto.foto_url ? (
                      <div
                        className="mb-5 aspect-square rounded-xl bg-tinta/5 bg-cover bg-center"
                        style={{
                          backgroundImage:
                            `url(${produto.foto_url})`,
                        }}
                        role="img"
                        aria-label={
                          produto.nome
                        }
                      />
                    ) : (
                      <div className="mb-5 flex aspect-square items-center justify-center rounded-xl bg-tinta/5 text-sm text-fumaca">
                        Sem foto
                      </div>
                    )}

                    <h2 className="font-display text-2xl">
                      {
                        produto.nome
                      }
                    </h2>

                    {produto.descricao ? (
                      <p className="mt-2 text-sm text-fumaca">
                        {
                          produto.descricao
                        }
                      </p>
                    ) : null}

                    <div className="mt-auto pt-4">
                      <p className="font-mono text-couro">
                        {dinheiro(
                          produto.preco
                        )}
                      </p>

                      <p className="mt-1 text-xs text-fumaca">
                        {estoque > 0
                          ? `${estoque} disponível(is)`
                          : "Indisponível"}
                      </p>

                      {!noCarrinho ? (
                        <Botao
                          type="button"
                          className="mt-4 w-full"
                          disabled={
                            estoque < 1
                          }
                          onClick={() =>
                            adicionar(
                              produto
                            )
                          }
                        >
                          Adicionar ao
                          carrinho
                        </Botao>
                      ) : (
                        <div className="mt-4">
                          <p className="mb-2 text-center text-xs font-semibold text-couro">
                            {
                              quantidade
                            }{" "}
                            no carrinho
                          </p>

                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                diminuir(
                                  produto
                                )
                              }
                              className="flex h-10 w-10 items-center justify-center border border-linha text-lg hover:bg-marfim"
                              aria-label={`Diminuir ${produto.nome}`}
                            >
                              −
                            </button>

                            <span className="min-w-10 text-center font-mono">
                              {
                                quantidade
                              }
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                aumentar(
                                  produto
                                )
                              }
                              disabled={
                                quantidade >=
                                estoque
                              }
                              className="flex h-10 w-10 items-center justify-center border border-linha text-lg hover:bg-marfim disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Aumentar ${produto.nome}`}
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              remover(
                                produto
                              )
                            }
                            className="mt-3 w-full text-center text-xs text-tinta/50 hover:text-red-800"
                          >
                            Remover do
                            carrinho
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>

      <aside className="h-fit rounded-2xl border border-linha bg-papel p-5 shadow-carta sm:p-6 lg:sticky lg:top-24">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">
              Carrinho
            </h2>

            {quantidadeTotal >
            0 ? (
              <p className="mt-1 text-xs text-fumaca">
                {
                  quantidadeTotal
                }{" "}
                item(ns) •{" "}
                {
                  itens.length
                }{" "}
                produto(s)
              </p>
            ) : null}
          </div>

          {itens.length >
          0 ? (
            <button
              type="button"
              onClick={
                limparCarrinho
              }
              className="text-xs text-tinta/50 hover:text-red-800"
            >
              Limpar
            </button>
          ) : null}
        </div>

        {erro ? (
          <div className="mt-4">
            <Aviso>
              {erro}
            </Aviso>
          </div>
        ) : null}

        <div className="mt-5 space-y-5">
          {itens.length ? (
            itens.map(
              (item) => (
                <div
                  key={
                    item.id
                  }
                  className="border-b border-linha pb-5 last:border-0 last:pb-0"
                >
                  <div className="flex justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold">
                        {
                          item.nome
                        }
                      </p>

                      <p className="mt-1 text-xs text-fumaca">
                        {dinheiro(
                          item.preco
                        )}{" "}
                        cada
                      </p>
                    </div>

                    <strong className="font-mono">
                      {dinheiro(
                        item.subtotal
                      )}
                    </strong>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          diminuir(
                            item
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center border border-linha hover:bg-marfim"
                        aria-label={`Diminuir ${item.nome}`}
                      >
                        −
                      </button>

                      <span className="min-w-8 text-center font-mono">
                        {
                          item.quantidade
                        }
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          aumentar(
                            item
                          )
                        }
                        disabled={
                          item.quantidade >=
                          estoqueDoProduto(
                            item
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center border border-linha hover:bg-marfim disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Aumentar ${item.nome}`}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        remover(
                          item
                        )
                      }
                      className="text-xs text-tinta/50 hover:text-red-800"
                    >
                      remover
                    </button>
                  </div>
                </div>
              )
            )
          ) : (
            <p className="text-sm text-fumaca">
              Nenhum produto
              adicionado ainda.
            </p>
          )}
        </div>

        <div className="mt-6 border-t border-linha pt-5">
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              Total
            </span>

            <strong className="font-mono text-lg text-couro">
              {dinheiro(
                total
              )}
            </strong>
          </div>

          <div className="mt-5">
            <Entrada
              placeholder="Seu nome (opcional)"
              value={
                nome
              }
              onChange={(e) => {
                setNome(
                  e.target.value
                );

                setResultado(
                  null
                );
              }}
            />
          </div>

          <Botao
            type="button"
            className="mt-4 w-full"
            disabled={
              !itens.length ||
              preparando
            }
            onClick={
              checkout
            }
          >
            {preparando
              ? "Preparando..."
              : "Preparar pedido"}
          </Botao>
        </div>

        {resultado ? (
          <div className="mt-5 space-y-3 border-t border-linha pt-5">
            {resultado.whatsapp_url ? (
              <a
                href={
                  resultado.whatsapp_url
                }
                target="_blank"
                rel="noreferrer"
                className="block bg-couro px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Abrir WhatsApp
              </a>
            ) : null}

            {resultado.pix ? (
              <>
                <p className="text-xs text-fumaca">
                  Pix Copia e Cola —
                  pagamento não é
                  confirmado
                  automaticamente.
                </p>

                <textarea
                  readOnly
                  value={
                    resultado.pix
                  }
                  rows={5}
                  className="w-full resize-none border border-linha bg-white p-2 text-xs"
                />

                <button
                  type="button"
                  onClick={
                    copiarPix
                  }
                  className="text-sm font-semibold text-couro hover:underline"
                >
                  Copiar Pix
                </button>
              </>
            ) : (
              <p className="text-xs text-fumaca">
                Pix indisponível:
                complete chave,
                recebedor e cidade
                nas configurações.
              </p>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
