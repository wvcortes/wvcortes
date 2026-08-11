import { NextResponse } from "next/server";
import { db, conferirAmbiente } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { limitesDoDia, diaLocal } from "@/lib/formato";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATA_RE =
  /^\d{4}-\d{2}-\d{2}$/;

const TIPOS_VALIDOS = [
  "servico",
  "produto",
];

const PAGAMENTOS_VALIDOS = [
  "Dinheiro",
  "Pix",
  "Débito",
  "Crédito",
];

const COLUNAS_VENDA = [
  "id",
  "colaborador_id",
  "cliente_id",
  "tipo",
  "servico_id",
  "produto_id",
  "descricao",
  "quantidade",
  "valor",
  "forma_pagamento",
  "criado_em",
].join(",");

function resposta(
  corpo,
  status = 200
) {
  return NextResponse.json(
    corpo,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

function texto(
  valor,
  limite = 255
) {
  return String(
    valor ?? ""
  )
    .trim()
    .slice(
      0,
      limite
    );
}

function dataValida(
  valor
) {
  if (
    !DATA_RE.test(
      valor
    )
  ) {
    return false;
  }

  const [
    ano,
    mes,
    dia,
  ] = valor
    .split("-")
    .map(Number);

  const teste =
    new Date(
      Date.UTC(
        ano,
        mes - 1,
        dia
      )
    );

  return (
    teste.getUTCFullYear() ===
      ano &&
    teste.getUTCMonth() ===
      mes - 1 &&
    teste.getUTCDate() ===
      dia
  );
}

function inteiroPositivo(
  valor,
  padrao = 1
) {
  if (
    valor ===
      undefined ||
    valor ===
      null ||
    valor ===
      ""
  ) {
    return padrao;
  }

  const convertido =
    Number(
      valor
    );

  if (
    !Number.isInteger(
      convertido
    ) ||
    convertido <
      1
  ) {
    return null;
  }

  return convertido;
}

function erroPareceEstoque(
  error
) {
  const mensagem =
    String(
      error?.message ||
        error?.details ||
        error?.hint ||
        ""
    ).toLowerCase();

  return (
    mensagem.includes(
      "estoque"
    ) ||
    mensagem.includes(
      "stock"
    ) ||
    mensagem.includes(
      "quantidade disponível"
    )
  );
}

async function obterUsuarioAutorizado() {
  const usuario =
    await usuarioAtual()
      .catch(
        () => null
      );

  if (
    !usuario ||
    usuario.papel ===
      "cliente"
  ) {
    return null;
  }

  return usuario;
}

async function validarColaborador(
  usuario,
  colaboradorInformado
) {
  if (
    usuario.papel ===
    "colaborador"
  ) {
    return {
      id:
        usuario.id,
    };
  }

  const colaboradorId =
    texto(
      colaboradorInformado,
      50
    );

  if (
    !UUID_RE.test(
      colaboradorId
    )
  ) {
    return {
      erro:
        "Selecione um colaborador válido.",
    };
  }

  const {
    data,
    error,
  } = await db
    .from(
      "usuarios"
    )
    .select(
      "id, papel, ativo"
    )
    .eq(
      "id",
      colaboradorId
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !data ||
    data.papel !==
      "colaborador" ||
    !data.ativo
  ) {
    return {
      erro:
        "Esse colaborador não está disponível.",
    };
  }

  return {
    id:
      data.id,
  };
}

async function validarItemCatalogo(
  tipo,
  id
) {
  if (
    !UUID_RE.test(
      id
    )
  ) {
    return {
      erro:
        tipo ===
        "produto"
          ? "Produto inválido."
          : "Serviço inválido.",
    };
  }

  if (
    tipo ===
    "servico"
  ) {
    const {
      data,
      error,
    } = await db
      .from(
        "servicos"
      )
      .select(
        "id, nome, preco, ativo"
      )
      .eq(
        "id",
        id
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (
      !data ||
      !data.ativo
    ) {
      return {
        erro:
          "Esse serviço não está disponível.",
      };
    }

    return {
      item:
        data,
    };
  }

  const {
    data,
    error,
  } = await db
    .from(
      "produtos"
    )
    .select(
      "id, nome, preco, estoque, ativo"
    )
    .eq(
      "id",
      id
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !data ||
    !data.ativo
  ) {
    return {
      erro:
        "Esse produto não está disponível.",
    };
  }

  return {
    item:
      data,
  };
}

function normalizarItensProduto(
  itens
) {
  if (
    !Array.isArray(
      itens
    )
  ) {
    return {
      erro:
        "Comanda de produtos inválida.",
    };
  }

  if (
    itens.length <
    1
  ) {
    return {
      erro:
        "Adicione pelo menos um produto à comanda.",
    };
  }

  if (
    itens.length >
    100
  ) {
    return {
      erro:
        "A comanda possui produtos demais.",
    };
  }

  const agrupados =
    new Map();

  for (
    const item
    of itens
  ) {
    const produtoId =
      texto(
        item?.produto_id ||
          item?.id,
        50
      );

    const quantidade =
      inteiroPositivo(
        item?.quantidade,
        1
      );

    if (
      !UUID_RE.test(
        produtoId
      )
    ) {
      return {
        erro:
          "Produto inválido na comanda.",
      };
    }

    if (
      quantidade ===
        null ||
      quantidade >
        999
    ) {
      return {
        erro:
          "Informe uma quantidade válida para todos os produtos.",
      };
    }

    const atual =
      agrupados.get(
        produtoId
      ) || 0;

    const novaQuantidade =
      atual +
      quantidade;

    if (
      novaQuantidade >
      999
    ) {
      return {
        erro:
          "A quantidade total de um produto não pode ultrapassar 999 unidades.",
      };
    }

    agrupados.set(
      produtoId,
      novaQuantidade
    );
  }

  return {
    itens:
      Array.from(
        agrupados.entries()
      ).map(
        ([
          produto_id,
          quantidade,
        ]) => ({
          produto_id,
          quantidade,
        })
      ),
  };
}

async function prepararVendaProdutosEmLote({
  usuario,
  corpo,
}) {
  const colaborador =
    await validarColaborador(
      usuario,
      corpo?.colaborador_id
    );

  if (
    colaborador.erro
  ) {
    return {
      erro:
        colaborador.erro,

      status:
        400,
    };
  }

  const formaPagamento =
    texto(
      corpo?.forma_pagamento ||
        "Dinheiro",
      30
    );

  if (
    !PAGAMENTOS_VALIDOS
      .includes(
        formaPagamento
      )
  ) {
    return {
      erro:
        "Forma de pagamento inválida.",

      status:
        400,
    };
  }

  const normalizado =
    normalizarItensProduto(
      corpo?.itens
    );

  if (
    normalizado.erro
  ) {
    return {
      erro:
        normalizado.erro,

      status:
        400,
    };
  }

  const ids =
    normalizado.itens.map(
      (
        item
      ) =>
        item.produto_id
    );

  const {
    data:
      produtosBanco = [],
    error,
  } = await db
    .from(
      "produtos"
    )
    .select(
      "id, nome, preco, estoque, ativo"
    )
    .in(
      "id",
      ids
    );

  if (error) {
    throw error;
  }

  const mapaProdutos =
    new Map(
      (
        produtosBanco ||
        []
      ).map(
        (
          produto
        ) => [
          produto.id,
          produto,
        ]
      )
    );

  const linhas = [];

  for (
    const item
    of normalizado.itens
  ) {
    const produto =
      mapaProdutos.get(
        item.produto_id
      );

    if (
      !produto ||
      !produto.ativo
    ) {
      return {
        erro:
          "Um dos produtos da comanda não está mais disponível.",

        status:
          400,
      };
    }

    const estoque =
      Number(
        produto.estoque ??
        0
      );

    if (
      !Number.isFinite(
        estoque
      ) ||
      estoque <
        item.quantidade
    ) {
      return {
        erro:
          `Estoque insuficiente para ${produto.nome}. Disponível: ${Math.max(
            0,
            Number.isFinite(
              estoque
            )
              ? estoque
              : 0
          )}.`,

        status:
          409,
      };
    }

    linhas.push({
      colaborador_id:
        colaborador.id,

      cliente_id:
        null,

      tipo:
        "produto",

      servico_id:
        null,

      produto_id:
        produto.id,

      descricao:
        texto(
          produto.nome,
          250
        ),

      quantidade:
        item.quantidade,

      valor:
        Number(
          produto.preco ||
          0
        ),

      forma_pagamento:
        formaPagamento,
    });
  }

  return {
    linhas,
  };
}

export async function GET(
  req
) {
  try {
    conferirAmbiente();

    const usuario =
      await obterUsuarioAutorizado();

    if (!usuario) {
      return resposta(
        {
          erro:
            "Sem permissão.",
        },
        403
      );
    }

    const parametros =
      new URL(
        req.url
      ).searchParams;

    const dataInformada =
      texto(
        parametros.get(
          "data"
        ) ||
          diaLocal(),
        10
      );

    if (
      !dataValida(
        dataInformada
      )
    ) {
      return resposta(
        {
          erro:
            "Data inválida.",

          itens: [],
        },
        400
      );
    }

    const {
      de,
      ate,
    } = limitesDoDia(
      dataInformada
    );

    if (
      !de ||
      !ate
    ) {
      return resposta(
        {
          erro:
            "Data inválida.",

          itens: [],
        },
        400
      );
    }

    let consulta =
      db
        .from(
          "vendas"
        )
        .select(
          COLUNAS_VENDA
        )
        .gte(
          "criado_em",
          de
        )
        .lte(
          "criado_em",
          ate
        )
        .order(
          "criado_em",
          {
            ascending:
              false,
          }
        );

    if (
      usuario.papel ===
      "colaborador"
    ) {
      consulta =
        consulta.eq(
          "colaborador_id",
          usuario.id
        );
    }

    const {
      data:
        itens,
      error,
    } =
      await consulta.limit(
        1000
      );

    if (error) {
      throw error;
    }

    return resposta({
      itens:
        itens ||
        [],
    });
  } catch (e) {
    console.error(
      "[api/vendas GET]",
      e
    );

    return resposta(
      {
        erro:
          process.env
            .NODE_ENV ===
          "development"
            ? e?.message ||
              "Não foi possível carregar as vendas."
            : "Não foi possível carregar as vendas.",
      },
      500
    );
  }
}

export async function POST(
  req
) {
  try {
    conferirAmbiente();

    const usuario =
      await obterUsuarioAutorizado();

    if (!usuario) {
      return resposta(
        {
          erro:
            "Sem permissão.",
        },
        403
      );
    }

    const contentType =
      req.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
      return resposta(
        {
          erro:
            "Requisição inválida.",
        },
        415
      );
    }

    let corpo;

    try {
      corpo =
        await req.json();
    } catch {
      return resposta(
        {
          erro:
            "Dados da venda inválidos.",
        },
        400
      );
    }

    const tipo =
      texto(
        corpo?.tipo ||
          "servico",
        20
      ).toLowerCase();

    if (
      !TIPOS_VALIDOS
        .includes(
          tipo
        )
    ) {
      return resposta(
        {
          erro:
            "Tipo de venda inválido.",
        },
        400
      );
    }

    if (
      tipo ===
        "produto" &&
      Array.isArray(
        corpo?.itens
      )
    ) {
      const preparado =
        await prepararVendaProdutosEmLote({
          usuario,
          corpo,
        });

      if (
        preparado.erro
      ) {
        return resposta(
          {
            erro:
              preparado.erro,
          },
          preparado.status ||
            400
        );
      }

      const {
        data,
        error,
      } = await db
        .from(
          "vendas"
        )
        .insert(
          preparado.linhas
        )
        .select(
          COLUNAS_VENDA
        );

      if (error) {
        if (
          erroPareceEstoque(
            error
          )
        ) {
          return resposta(
            {
              erro:
                "O estoque mudou enquanto a comanda era finalizada. Revise as quantidades e tente novamente.",
            },
            409
          );
        }

        throw error;
      }

      return resposta(
        {
          itens:
            data || [],

          item:
            data?.[0] ||
            null,
        },
        201
      );
    }

    const colaborador =
      await validarColaborador(
        usuario,
        corpo?.colaborador_id
      );

    if (
      colaborador.erro
    ) {
      return resposta(
        {
          erro:
            colaborador.erro,
        },
        400
      );
    }

    const quantidade =
      inteiroPositivo(
        corpo?.quantidade,
        1
      );

    if (
      quantidade ===
        null ||
      quantidade >
        999
    ) {
      return resposta(
        {
          erro:
            "Informe uma quantidade válida.",
        },
        400
      );
    }

    const formaPagamento =
      texto(
        corpo?.forma_pagamento ||
          "Dinheiro",
        30
      );

    if (
      !PAGAMENTOS_VALIDOS
        .includes(
          formaPagamento
        )
    ) {
      return resposta(
        {
          erro:
            "Forma de pagamento inválida.",
        },
        400
      );
    }

    const catalogoId =
      texto(
        tipo ===
          "servico"
          ? corpo?.servico_id
          : corpo?.produto_id,
        50
      );

    const catalogo =
      await validarItemCatalogo(
        tipo,
        catalogoId
      );

    if (
      catalogo.erro
    ) {
      return resposta(
        {
          erro:
            catalogo.erro,
        },
        400
      );
    }

    const descricao =
      texto(
        corpo?.descricao,
        250
      ) ||
      texto(
        catalogo.item.nome,
        250
      );

    if (!descricao) {
      return resposta(
        {
          erro:
            "Informe a descrição da venda.",
        },
        400
      );
    }

    if (
      tipo ===
      "produto"
    ) {
      const estoque =
        Number(
          catalogo
            .item
            .estoque ??
          0
        );

      if (
        !Number.isFinite(
          estoque
        ) ||
        estoque <
          quantidade
      ) {
        return resposta(
          {
            erro:
              `Estoque insuficiente. Disponível: ${Math.max(
                0,
                Number.isFinite(
                  estoque
                )
                  ? estoque
                  : 0
              )}.`,
          },
          409
        );
      }
    }

    const dados = {
      colaborador_id:
        colaborador.id,

      cliente_id:
        null,

      tipo,

      servico_id:
        tipo ===
        "servico"
          ? catalogo.item.id
          : null,

      produto_id:
        tipo ===
        "produto"
          ? catalogo.item.id
          : null,

      descricao,

      quantidade,

      valor:
        Number(
          catalogo.item.preco
        ),

      forma_pagamento:
        formaPagamento,
    };

    const {
      data,
      error,
    } = await db
      .from(
        "vendas"
      )
      .insert(
        dados
      )
      .select(
        COLUNAS_VENDA
      )
      .single();

    if (error) {
      if (
        erroPareceEstoque(
          error
        )
      ) {
        return resposta(
          {
            erro:
              "O estoque mudou enquanto a venda era finalizada. Revise a quantidade e tente novamente.",
          },
          409
        );
      }

      throw error;
    }

    return resposta(
      {
        item:
          data,
      },
      201
    );
  } catch (e) {
    console.error(
      "[api/vendas POST]",
      e
    );

    return resposta(
      {
        erro:
          process.env
            .NODE_ENV ===
          "development"
            ? e?.message ||
              "Não foi possível lançar a venda."
            : "Não foi possível lançar a venda.",
      },
      500
    );
  }
}

export async function DELETE(
  req
) {
  try {
    conferirAmbiente();

    const usuario =
      await obterUsuarioAutorizado();

    if (!usuario) {
      return resposta(
        {
          erro:
            "Sem permissão.",
        },
        403
      );
    }

    const id =
      texto(
        new URL(
          req.url
        ).searchParams.get(
          "id"
        ),
        50
      );

    if (
      !UUID_RE.test(
        id
      )
    ) {
      return resposta(
        {
          erro:
            "Venda inválida.",
        },
        400
      );
    }

    let consulta =
      db
        .from(
          "vendas"
        )
        .delete()
        .eq(
          "id",
          id
        );

    if (
      usuario.papel ===
      "colaborador"
    ) {
      consulta =
        consulta.eq(
          "colaborador_id",
          usuario.id
        );
    }

    const {
      data,
      error,
    } =
      await consulta
        .select(
          "id"
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return resposta(
        {
          erro:
            "Venda não encontrada ou sem permissão para excluí-la.",
        },
        404
      );
    }

    return resposta({
      ok:
        true,
    });
  } catch (e) {
    console.error(
      "[api/vendas DELETE]",
      e
    );

    return resposta(
      {
        erro:
          process.env
            .NODE_ENV ===
          "development"
            ? e?.message ||
              "Não foi possível excluir a venda."
            : "Não foi possível excluir a venda.",
      },
      500
    );
  }
}