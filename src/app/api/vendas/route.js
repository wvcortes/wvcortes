import { NextResponse } from "next/server";
import { db, conferirAmbiente } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { limitesDoDia, diaLocal } from "@/lib/formato";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

const TIPOS_VALIDOS = ["servico", "produto"];

const PAGAMENTOS_VALIDOS = [
  "Dinheiro",
  "Pix",
  "Débito",
  "Crédito",
];

function resposta(corpo, status = 200) {
  return NextResponse.json(corpo, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function texto(valor, limite = 255) {
  return String(valor ?? "")
    .trim()
    .slice(0, limite);
}

function dataValida(valor) {
  if (!DATA_RE.test(valor)) {
    return false;
  }

  const [ano, mes, dia] = valor
    .split("-")
    .map(Number);

  const teste = new Date(
    Date.UTC(ano, mes - 1, dia)
  );

  return (
    teste.getUTCFullYear() === ano &&
    teste.getUTCMonth() === mes - 1 &&
    teste.getUTCDate() === dia
  );
}

function numero(valor) {
  const convertido = Number(
    String(valor ?? "").replace(",", ".")
  );

  return Number.isFinite(convertido)
    ? convertido
    : null;
}

function inteiroPositivo(valor, padrao = 1) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return padrao;
  }

  const convertido = Number(valor);

  if (
    !Number.isInteger(convertido) ||
    convertido < 1
  ) {
    return null;
  }

  return convertido;
}

async function obterUsuarioAutorizado() {
  const usuario =
    await usuarioAtual().catch(() => null);

  if (
    !usuario ||
    usuario.papel === "cliente"
  ) {
    return null;
  }

  return usuario;
}

async function validarColaborador(
  usuario,
  colaboradorInformado
) {
  /**
   * Colaborador nunca pode lançar venda
   * em nome de outro colaborador.
   */
  if (usuario.papel === "colaborador") {
    return {
      id: usuario.id,
    };
  }

  /**
   * Admin precisa informar um colaborador real.
   */
  const colaboradorId = texto(
    colaboradorInformado,
    50
  );

  if (!UUID_RE.test(colaboradorId)) {
    return {
      erro:
        "Selecione um colaborador válido.",
    };
  }

  const {
    data,
    error,
  } = await db
    .from("usuarios")
    .select("id, papel, ativo")
    .eq("id", colaboradorId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !data ||
    data.papel !== "colaborador" ||
    !data.ativo
  ) {
    return {
      erro:
        "Esse colaborador não está disponível.",
    };
  }

  return {
    id: data.id,
  };
}

async function validarItemCatalogo(
  tipo,
  id
) {
  if (!UUID_RE.test(id)) {
    return {
      erro:
        tipo === "produto"
          ? "Produto inválido."
          : "Serviço inválido.",
    };
  }

  /**
   * Serviço.
   */
  if (tipo === "servico") {
    const {
      data,
      error,
    } = await db
      .from("servicos")
      .select(
        "id, nome, preco, ativo"
      )
      .eq("id", id)
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
      item: data,
    };
  }

  /**
   * Produto.
   */
  const {
    data,
    error,
  } = await db
    .from("produtos")
    .select(
      "id, nome, preco, estoque, ativo"
    )
    .eq("id", id)
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
    item: data,
  };
}

/**
 * GET /api/vendas?data=2026-08-10
 *
 * Colaborador:
 * vê somente as próprias vendas.
 *
 * Admin:
 * pode consultar todas.
 */
export async function GET(req) {
  try {
    conferirAmbiente();

    const usuario =
      await obterUsuarioAutorizado();

    if (!usuario) {
      return resposta(
        {
          erro: "Sem permissão.",
        },
        403
      );
    }

    const parametros =
      new URL(req.url).searchParams;

    const dataInformada = texto(
      parametros.get("data") ||
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
          erro: "Data inválida.",
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

    if (!de || !ate) {
      return resposta(
        {
          erro: "Data inválida.",
          itens: [],
        },
        400
      );
    }

    let consulta = db
      .from("vendas")
      .select(
        [
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
        ].join(",")
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
          ascending: false,
        }
      );

    /**
     * Colaborador só enxerga
     * as próprias vendas.
     */
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
      data: itens,
      error,
    } = await consulta.limit(
      1000
    );

    if (error) {
      throw error;
    }

    return resposta({
      itens:
        itens || [],
    });
  } catch (e) {
    console.error(
      "[api/vendas GET]",
      e
    );

    return resposta(
      {
        erro:
          process.env.NODE_ENV ===
          "development"
            ? e?.message ||
              "Não foi possível carregar as vendas."
            : "Não foi possível carregar as vendas.",
      },
      500
    );
  }
}

/**
 * POST /api/vendas
 *
 * Lançamento rápido pelo colaborador.
 *
 * Admin também pode utilizar esta rota,
 * mas precisa informar um colaborador válido.
 */
export async function POST(req) {
  try {
    conferirAmbiente();

    const usuario =
      await obterUsuarioAutorizado();

    if (!usuario) {
      return resposta(
        {
          erro: "Sem permissão.",
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

    const tipo = texto(
      corpo?.tipo ||
        "servico",
      20
    ).toLowerCase();

    if (
      !TIPOS_VALIDOS.includes(
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

    /**
     * Descobre em nome de qual colaborador
     * a venda será lançada.
     */
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

    /**
     * Quantidade.
     */
    const quantidade =
      inteiroPositivo(
        corpo?.quantidade,
        1
      );

    if (
      quantidade === null ||
      quantidade > 999
    ) {
      return resposta(
        {
          erro:
            "Informe uma quantidade válida.",
        },
        400
      );
    }

    /**
     * Valor UNITÁRIO.
     *
     * O painel calcula:
     *
     * valor × quantidade
     *
     * para obter o total.
     */
    const valor =
      numero(
        corpo?.valor
      );

    if (
      valor === null ||
      valor < 0 ||
      valor >
        999999.99
    ) {
      return resposta(
        {
          erro:
            "Informe um valor válido.",
        },
        400
      );
    }

    /**
     * Forma de pagamento.
     */
    const formaPagamento =
      texto(
        corpo?.forma_pagamento ||
          "Dinheiro",
        30
      );

    if (
      !PAGAMENTOS_VALIDOS.includes(
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

    /**
     * Serviço ou produto oficial do banco.
     */
    const catalogoId =
      texto(
        tipo === "servico"
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

    /**
     * A descrição pode ser personalizada,
     * mas se vier vazia usamos o nome
     * oficial do item.
     */
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

    /**
     * Por enquanto conferimos estoque,
     * mas a baixa automática será feita
     * de forma centralizada no próximo passo.
     *
     * Isso evita implementar estoque apenas
     * para colaborador e esquecer vendas
     * lançadas pelo admin.
     */
    if (
      tipo === "produto"
    ) {
      const estoque =
        Number(
          catalogo.item
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
                estoque || 0
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
          ? catalogo
              .item.id
          : null,

      produto_id:
        tipo ===
        "produto"
          ? catalogo
              .item.id
          : null,

      descricao,

      quantidade,

      valor,

      forma_pagamento:
        formaPagamento,
    };

    const {
      data,
      error,
    } = await db
      .from("vendas")
      .insert(dados)
      .select(
        [
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
        ].join(",")
      )
      .single();

    if (error) {
      throw error;
    }

    return resposta(
      {
        item: data,
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
          process.env.NODE_ENV ===
          "development"
            ? e?.message ||
              "Não foi possível lançar a venda."
            : "Não foi possível lançar a venda.",
      },
      500
    );
  }
}

/**
 * DELETE /api/vendas?id=<uuid>
 *
 * Colaborador:
 * só pode excluir venda própria.
 *
 * Admin:
 * pode excluir qualquer venda.
 */
export async function DELETE(req) {
  try {
    conferirAmbiente();

    const usuario =
      await obterUsuarioAutorizado();

    if (!usuario) {
      return resposta(
        {
          erro: "Sem permissão.",
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

    if (!UUID_RE.test(id)) {
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
        .from("vendas")
        .delete()
        .eq(
          "id",
          id
        );

    /**
     * Colaborador só pode apagar
     * lançamento dele mesmo.
     */
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
    } = await consulta
      .select("id")
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
      ok: true,
    });
  } catch (e) {
    console.error(
      "[api/vendas DELETE]",
      e
    );

    return resposta(
      {
        erro:
          process.env.NODE_ENV ===
          "development"
            ? e?.message ||
              "Não foi possível excluir a venda."
            : "Não foi possível excluir a venda.",
      },
      500
    );
  }
}