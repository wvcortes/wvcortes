import { NextResponse } from "next/server";
import { db, conferirAmbiente } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";
import { pegarRecurso, tabelaDe } from "@/lib/recursos";
import { montarPayload } from "@/lib/payload";
import { diaLocal, limitesDoDia } from "@/lib/formato";
import { resolverUnidadeEfetiva } from "@/lib/unidades";

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
      .select("id, papel, ativo, unidade_id")
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
  const dataLocalAgendamento = diaLocal(inicio);
  const unidadeEfetiva = await resolverUnidadeEfetiva(profissionalId, dataLocalAgendamento, profissional.unidade_id);
  if (!UUID_RE.test(texto(dados.unidade_id, 50)) || unidadeEfetiva !== dados.unidade_id) return { erro: "O profissional não atende na unidade selecionada nessa data.", status: 400 };

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
    unidades: [["usuarios", "unidade_id"], ["agendamentos", "unidade_id"]],
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

    const parametros = await params;
    const recurso =
      parametros.recurso;

    const id =
      texto(
        parametros.id,
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

    if (recurso === "equipe" && dados.unidade_id) {
      const unidade = await db.from("unidades").select("id").eq("id", dados.unidade_id)
        .eq("ativo", true).is("excluido_em", null).maybeSingle();
      if (unidade.error) throw unidade.error;
      if (!unidade.data) return NextResponse.json({ erro: "A unidade padrão informada não está disponível." }, { status: 400 });
      const { data: futuros = [], error: erroFuturos } = await db
        .from("agendamentos")
        .select("inicio,unidade_id")
        .eq("profissional_id", id)
        .neq("status", "cancelado")
        .gte("inicio", new Date().toISOString());
      if (erroFuturos) throw erroFuturos;
      for (const agendamento of futuros) {
        const dataAgendamento = diaLocal(new Date(agendamento.inicio));
        const efetiva = await resolverUnidadeEfetiva(id, dataAgendamento, dados.unidade_id);
        if (efetiva !== agendamento.unidade_id) {
          return NextResponse.json({ erro: "Não é possível alterar a unidade padrão: existem agendamentos ativos futuros associados a outra unidade/data." }, { status: 409 });
        }
      }
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

    const parametros = await params;
    const recurso =
      parametros.recurso;

    const id =
      texto(
        parametros.id,
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

    if (recurso === "equipe") {
      const { data, error } = await db
        .from("usuarios")
        .update({ ativo: false, excluido_em: new Date().toISOString(), excluido_por: admin.id })
        .eq("id", id)
        .eq("papel", "colaborador")
        .is("excluido_em", null)
        .select("id")
        .maybeSingle();
      if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
      if (!data) return NextResponse.json({ erro: "Colaborador não encontrado ou já está na lixeira." }, { status: 404 });
      return NextResponse.json({ ok: true, recuperavel_ate: new Date(Date.now() + 86400000).toISOString() });
    }

    if (recurso === "unidades") {
      const atual = await db.from("unidades").select("id,ativo").eq("id", id).is("excluido_em", null).maybeSingle();
      if (atual.error) return NextResponse.json({ erro: atual.error.message }, { status: 400 });
      if (!atual.data) return NextResponse.json({ erro: "Unidade não encontrada ou já está na lixeira." }, { status: 404 });
      const { data, error } = await db
        .from("unidades")
        .update({ ativo: false, ativo_antes_exclusao: atual.data.ativo, excluido_em: new Date().toISOString(), excluido_por: admin.id })
        .eq("id", id)
        .is("excluido_em", null)
        .select("id")
        .maybeSingle();
      if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
      if (!data) return NextResponse.json({ erro: "Unidade não encontrada ou já está na lixeira." }, { status: 404 });
      return NextResponse.json({ ok: true, recuperavel_ate: new Date(Date.now() + 86400000).toISOString() });
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

export async function PATCH(req, { params }) {
  try {
    conferirAmbiente();
    const admin = await exigirPapel(["admin"]);
    if (!admin) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    const { recurso, id } = await params;
    if (!["equipe", "unidades"].includes(recurso) || !UUID_RE.test(id)) return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
    const corpo = await req.json().catch(() => ({}));
    if (recurso === "unidades" && corpo.acao === "verificar_exclusao") {
      const { count, error } = await db.from("usuarios").select("id", { count: "exact", head: true })
        .eq("papel", "colaborador").eq("ativo", true).is("excluido_em", null).eq("unidade_id", id);
      if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
      return NextResponse.json({ colaboradores_ativos: count || 0 });
    }
    if (!["restaurar", "desativar", "reativar"].includes(corpo.acao)) return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });

    const tabela = recurso === "unidades" ? "unidades" : "usuarios";
    let restauracaoUnidade = null;
    if (recurso === "unidades" && corpo.acao === "restaurar") {
      const atual = await db.from("unidades").select("ativo_antes_exclusao").eq("id", id)
        .not("excluido_em", "is", null).gte("excluido_em", new Date(Date.now() - 86400000).toISOString()).maybeSingle();
      if (atual.error) return NextResponse.json({ erro: atual.error.message }, { status: 400 });
      if (!atual.data) return NextResponse.json({ erro: "O prazo de recuperação expirou." }, { status: 409 });
      restauracaoUnidade = { excluido_em: null, excluido_por: null, ativo: atual.data.ativo_antes_exclusao ?? true, ativo_antes_exclusao: null };
    }
    let consulta = db.from(tabela).update(
      restauracaoUnidade || (corpo.acao === "restaurar"
        ? { excluido_em: null, excluido_por: null, ativo: true }
        : { ativo: corpo.acao === "reativar" })
    ).eq("id", id);
    if (recurso === "equipe") consulta = consulta.eq("papel", "colaborador");
    if (corpo.acao === "restaurar") {
      consulta = consulta.not("excluido_em", "is", null)
        .gte("excluido_em", new Date(Date.now() - 86400000).toISOString());
    } else {
      consulta = consulta.is("excluido_em", null);
    }
    const { data, error } = await consulta.select("id").maybeSingle();
    if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ erro: corpo.acao === "restaurar" ? "O prazo de recuperação expirou." : `${recurso === "unidades" ? "Unidade" : "Colaborador"} não encontrado.` }, { status: 409 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json({ erro: e?.message || "Não foi possível concluir a ação." }, { status: 500 });
  }
}
