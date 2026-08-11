import { NextResponse } from "next/server";
import { db, conferirAmbiente } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";
import { pegarRecurso, tabelaDe } from "@/lib/recursos";
import { montarPayload } from "@/lib/payload";
import { diaLocal, limitesDoDia } from "@/lib/formato";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function texto(valor, max = 255) {
  return String(valor ?? "").trim().slice(0, max);
}

function colunasSeguras(config) {
  const colunas = new Set(["id"]);

  for (const campo of config.campos || []) {
    if (campo.tipo === "senha") continue;
    colunas.add(campo.nome);
  }

  return Array.from(colunas).join(",");
}

function sanitizarItem(item) {
  if (!item || typeof item !== "object") return item;

  const copia = { ...item };

  delete copia.senha;
  delete copia.senha_hash;

  return copia;
}

function validarSelecoes(config, corpo) {
  for (const campo of config.campos || []) {
    if (
      campo.tipo !== "selecao" ||
      !(campo.nome in corpo)
    ) {
      continue;
    }

    const valor = corpo[campo.nome];

    if (
      valor === "" ||
      valor === null ||
      valor === undefined
    ) {
      continue;
    }

    if (!(campo.opcoes || []).includes(valor)) {
      return `Valor inválido para ${
        campo.rotulo || campo.nome
      }.`;
    }
  }

  return null;
}

function aplicarFiltroFixo(consulta, config) {
  if (!config.filtroFixo) {
    return consulta;
  }

  return consulta.eq(
    config.filtroFixo.coluna,
    config.filtroFixo.valor
  );
}

async function prepararAgendamentoParaEdicao(
  dados,
  id
) {
  const profissionalId = texto(
    dados.profissional_id,
    50
  );

  const servicoId = texto(
    dados.servico_id,
    50
  );

  if (
    !UUID_RE.test(profissionalId) ||
    !UUID_RE.test(servicoId)
  ) {
    return {
      erro: "Serviço ou profissional inválido.",
      status: 400,
    };
  }

  const inicio = new Date(dados.inicio);

  if (Number.isNaN(inicio.getTime())) {
    return {
      erro: "Informe uma data e horário válidos.",
      status: 400,
    };
  }

  const [
    servicoResp,
    profissionalResp,
  ] = await Promise.all([
    db
      .from("servicos")
      .select(
        "id, preco, duracao_min, ativo"
      )
      .eq("id", servicoId)
      .maybeSingle(),

    db
      .from("usuarios")
      .select("id, papel, ativo")
      .eq("id", profissionalId)
      .maybeSingle(),
  ]);

  if (servicoResp.error) {
    throw servicoResp.error;
  }

  if (profissionalResp.error) {
    throw profissionalResp.error;
  }

  const servico = servicoResp.data;
  const profissional =
    profissionalResp.data;

  if (
    !servico ||
    !servico.ativo
  ) {
    return {
      erro: "Esse serviço não está disponível.",
      status: 400,
    };
  }

  if (
    !profissional ||
    profissional.papel !== "colaborador" ||
    !profissional.ativo
  ) {
    return {
      erro:
        "Esse profissional não está disponível.",
      status: 400,
    };
  }

  const duracao = Number(
    servico.duracao_min
  );

  if (
    !Number.isFinite(duracao) ||
    duracao <= 0 ||
    duracao > 24 * 60
  ) {
    return {
      erro:
        "A duração desse serviço é inválida.",
      status: 400,
    };
  }

  const fim = new Date(
    inicio.getTime() +
      duracao * 60000
  );

  if (dados.status !== "cancelado") {
    const dataLocal =
      diaLocal(inicio);

    const {
      de,
      ate,
    } = limitesDoDia(
      dataLocal
    );

    if (!de || !ate) {
      return {
        erro:
          "Não foi possível determinar o dia do agendamento.",
        status: 400,
      };
    }

    const {
      data: ocupados = [],
      error,
    } = await db
      .from("agendamentos")
      .select(
        "id, inicio, fim"
      )
      .eq(
        "profissional_id",
        profissionalId
      )
      .neq(
        "status",
        "cancelado"
      )
      .neq(
        "id",
        id
      )
      .gte(
        "inicio",
        de
      )
      .lte(
        "inicio",
        ate
      );

    if (error) {
      throw error;
    }

    const conflita =
      (ocupados || []).some(
        (ocupado) => {
          const inicioOcupado =
            new Date(
              ocupado.inicio
            );

          const fimOcupado =
            ocupado.fim
              ? new Date(
                  ocupado.fim
                )
              : new Date(
                  inicioOcupado.getTime() +
                    30 *
                      60000
                );

          if (
            Number.isNaN(
              inicioOcupado.getTime()
            ) ||
            Number.isNaN(
              fimOcupado.getTime()
            )
          ) {
            return false;
          }

          return (
            inicio <
              fimOcupado &&
            fim >
              inicioOcupado
          );
        }
      );

    if (conflita) {
      return {
        erro:
          "Esse horário conflita com outro agendamento do profissional.",
        status: 409,
      };
    }
  }

  return {
    dados: {
      ...dados,

      profissional_id:
        profissionalId,

      servico_id:
        servicoId,

      inicio:
        inicio.toISOString(),

      fim:
        fim.toISOString(),

      preco:
        Number(
          servico.preco || 0
        ),
    },
  };
}

async function possuiDependencias(
  recurso,
  id
) {
  const verificacoes = {
    equipe: [
      [
        "agendamentos",
        "profissional_id",
      ],
      [
        "vendas",
        "colaborador_id",
      ],
    ],

    clientes: [
      [
        "agendamentos",
        "cliente_id",
      ],
      [
        "assinaturas",
        "cliente_id",
      ],
      [
        "vendas",
        "cliente_id",
      ],
    ],

    servicos: [
      [
        "agendamentos",
        "servico_id",
      ],
      [
        "vendas",
        "servico_id",
      ],
    ],

    produtos: [
      [
        "vendas",
        "produto_id",
      ],
    ],

    planos: [
      [
        "assinaturas",
        "plano_id",
      ],
    ],
  };

  const dependencias =
    verificacoes[recurso] || [];

  for (const [
    tabela,
    coluna,
  ] of dependencias) {
    const {
      count,
      error,
    } = await db
      .from(tabela)
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        coluna,
        id
      );

    if (error) {
      throw error;
    }

    if (
      (count || 0) >
      0
    ) {
      return true;
    }
  }

  return false;
}

export async function PUT(
  req,
  {
    params,
  }
) {
  try {
    conferirAmbiente();

    const admin =
      await exigirPapel([
        "admin",
      ]);

    if (!admin) {
      return NextResponse.json(
        {
          erro: "Sem permissão.",
        },
        {
          status: 403,
        }
      );
    }

    const recurso =
      params.recurso;

    const id =
      texto(
        params.id,
        50
      );

    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        {
          erro:
            "Identificador inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const config =
      pegarRecurso(
        recurso
      );

    if (!config) {
      return NextResponse.json(
        {
          erro:
            "Recurso inexistente.",
        },
        {
          status: 404,
        }
      );
    }

    const corpo =
      await req.json();

    const erroSelecao =
      validarSelecoes(
        config,
        corpo
      );

    if (erroSelecao) {
      return NextResponse.json(
        {
          erro:
            erroSelecao,
        },
        {
          status: 400,
        }
      );
    }

    let dados =
      montarPayload(
        config,
        corpo
      );

    if (dados.email) {
      dados.email =
        texto(
          dados.email,
          180
        ).toLowerCase();
    }

    if (
      recurso ===
      "agendamentos"
    ) {
      const preparado =
        await prepararAgendamentoParaEdicao(
          dados,
          id
        );

      if (
        preparado.erro
      ) {
        return NextResponse.json(
          {
            erro:
              preparado.erro,
          },
          {
            status:
              preparado.status ||
              400,
          }
        );
      }

      dados =
        preparado.dados;
    }

    if (
      Object.keys(dados)
        .length === 0
    ) {
      return NextResponse.json(
        {
          erro:
            "Nenhum dado válido foi informado.",
        },
        {
          status: 400,
        }
      );
    }

    let consulta =
      db
        .from(
          tabelaDe(
            recurso
          )
        )
        .update(
          dados
        )
        .eq(
          "id",
          id
        );

    consulta =
      aplicarFiltroFixo(
        consulta,
        config
      );

    const {
      data,
      error,
    } = await consulta
      .select(
        colunasSeguras(
          config
        )
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          erro:
            error.message,
        },
        {
          status: 400,
        }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          erro:
            "Registro não encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      item:
        sanitizarItem(
          data
        ),
    });
  } catch (e) {
    return NextResponse.json(
      {
        erro:
          e?.message ||
          "Não foi possível atualizar o registro.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  _req,
  {
    params,
  }
) {
  try {
    conferirAmbiente();

    const admin =
      await exigirPapel([
        "admin",
      ]);

    if (!admin) {
      return NextResponse.json(
        {
          erro: "Sem permissão.",
        },
        {
          status: 403,
        }
      );
    }

    const recurso =
      params.recurso;

    const id =
      texto(
        params.id,
        50
      );

    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        {
          erro:
            "Identificador inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const config =
      pegarRecurso(
        recurso
      );

    if (!config) {
      return NextResponse.json(
        {
          erro:
            "Recurso inexistente.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      id ===
      admin.id
    ) {
      return NextResponse.json(
        {
          erro:
            "Você não pode excluir o próprio acesso.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      await possuiDependencias(
        recurso,
        id
      )
    ) {
      return NextResponse.json(
        {
          erro:
            "Este registro já possui histórico no sistema e não pode ser excluído. Edite-o e marque como inativo quando essa opção estiver disponível.",
        },
        {
          status: 409,
        }
      );
    }

    let consulta =
      db
        .from(
          tabelaDe(
            recurso
          )
        )
        .delete()
        .eq(
          "id",
          id
        );

    consulta =
      aplicarFiltroFixo(
        consulta,
        config
      );

    const {
      data,
      error,
    } = await consulta
      .select(
        "id"
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          erro:
            error.message,
        },
        {
          status: 400,
        }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          erro:
            "Registro não encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (e) {
    return NextResponse.json(
      {
        erro:
          e?.message ||
          "Não foi possível excluir o registro.",
      },
      {
        status: 500,
      }
    );
  }
}