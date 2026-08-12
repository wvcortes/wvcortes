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
  return String(valor ?? "")
    .trim()
    .slice(0, max);
}

function vazio(valor) {
  return (
    valor === undefined ||
    valor === null ||
    (typeof valor === "string" &&
      valor.trim() === "")
  );
}

function colunasSeguras(config) {
  const colunas = new Set(["id"]);

  for (const campo of config.campos || []) {
    if (campo.tipo === "senha") {
      continue;
    }

    colunas.add(campo.nome);
  }

  return Array.from(colunas).join(",");
}

function sanitizarItem(item) {
  if (!item || typeof item !== "object") {
    return item;
  }

  const copia = {
    ...item,
  };

  delete copia.senha_hash;
  delete copia.senha;

  return copia;
}

function validarObrigatorios(
  config,
  corpo,
  criando = false
) {
  for (const campo of config.campos || []) {
    const obrigatorio =
      campo.obrigatorio ||
      (criando &&
        campo.obrigatorioAoCriar);

    if (!obrigatorio) {
      continue;
    }

    if (vazio(corpo?.[campo.nome])) {
      return `Informe: ${
        campo.rotulo ||
        campo.nome
      }.`;
    }
  }

  return null;
}

async function unidadeEfetivaDoProfissional({
  profissionalId,
  unidadePadraoId,
  dataLocal,
}) {
  const {
    data,
    error,
  } = await db
    .from("profissional_locais_data")
    .select("unidade_id")
    .eq(
      "profissional_id",
      profissionalId
    )
    .eq(
      "data",
      dataLocal
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    data?.unidade_id ||
    unidadePadraoId ||
    null
  );
}

async function prepararAgendamento(
  dados
) {
  const profissionalId =
    texto(
      dados.profissional_id,
      50
    );

  const servicoId =
    texto(
      dados.servico_id,
      50
    );

  const unidadeId =
    texto(
      dados.unidade_id,
      50
    );

  if (
    !UUID_RE.test(
      profissionalId
    ) ||
    !UUID_RE.test(
      servicoId
    ) ||
    !UUID_RE.test(
      unidadeId
    )
  ) {
    return {
      erro:
        "Serviço, profissional ou unidade inválidos.",
      status: 400,
    };
  }

  const inicio =
    new Date(
      dados.inicio
    );

  if (
    Number.isNaN(
      inicio.getTime()
    )
  ) {
    return {
      erro:
        "Informe uma data e horário válidos.",
      status: 400,
    };
  }

  if (
    inicio.getTime() <=
    Date.now()
  ) {
    return {
      erro:
        "O agendamento precisa ser em um horário futuro.",
      status: 400,
    };
  }

  const dataLocal =
    diaLocal(
      inicio
    );

  if (!dataLocal) {
    return {
      erro:
        "Não foi possível determinar o dia do agendamento.",
      status: 400,
    };
  }

  const [
    servicoResp,
    profissionalResp,
    unidadeResp,
    profissionalServicoResp,
  ] = await Promise.all([
    db
      .from("servicos")
      .select(
        "id, preco, duracao_min, ativo"
      )
      .eq(
        "id",
        servicoId
      )
      .maybeSingle(),

    db
      .from("usuarios")
      .select(
        "id, papel, ativo, unidade_id"
      )
      .eq(
        "id",
        profissionalId
      )
      .maybeSingle(),

    db
      .from("unidades")
      .select(
        "id, ativo"
      )
      .eq(
        "id",
        unidadeId
      )
      .maybeSingle(),

    db
      .from(
        "profissional_servicos"
      )
      .select(
        "profissional_id"
      )
      .eq(
        "profissional_id",
        profissionalId
      )
      .eq(
        "servico_id",
        servicoId
      )
      .maybeSingle(),
  ]);

  if (servicoResp.error) {
    throw servicoResp.error;
  }

  if (
    profissionalResp.error
  ) {
    throw profissionalResp.error;
  }

  if (unidadeResp.error) {
    throw unidadeResp.error;
  }

  if (
    profissionalServicoResp.error
  ) {
    throw profissionalServicoResp.error;
  }

  const servico =
    servicoResp.data;

  const profissional =
    profissionalResp.data;

  const unidade =
    unidadeResp.data;

  if (
    !servico ||
    !servico.ativo
  ) {
    return {
      erro:
        "Esse serviço não está disponível.",
      status: 400,
    };
  }

  if (
    !profissional ||
    profissional.papel !==
      "colaborador" ||
    !profissional.ativo
  ) {
    return {
      erro:
        "Esse profissional não está disponível.",
      status: 400,
    };
  }

  if (
    !unidade ||
    !unidade.ativo
  ) {
    return {
      erro:
        "Essa unidade não está disponível.",
      status: 400,
    };
  }

  if (
    !profissionalServicoResp.data
  ) {
    return {
      erro:
        "Esse profissional não realiza o serviço selecionado.",
      status: 400,
    };
  }

  const unidadeEfetiva =
    await unidadeEfetivaDoProfissional({
      profissionalId,
      unidadePadraoId:
        profissional.unidade_id,
      dataLocal,
    });

  if (
    !unidadeEfetiva ||
    unidadeEfetiva !==
      unidadeId
  ) {
    return {
      erro:
        "Esse profissional não atende nessa unidade na data escolhida.",
      status: 400,
    };
  }

  const duracao =
    Number(
      servico.duracao_min
    );

  if (
    !Number.isFinite(
      duracao
    ) ||
    duracao <= 0 ||
    duracao >
      24 * 60
  ) {
    return {
      erro:
        "A duração desse serviço é inválida.",
      status: 400,
    };
  }

  const fim =
    new Date(
      inicio.getTime() +
        duracao *
          60000
    );

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

  if (
    dados.status !==
    "cancelado"
  ) {
    const {
      data: ocupados = [],
      error,
    } = await db
      .from(
        "agendamentos"
      )
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
      (
        ocupados || []
      ).some(
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

      unidade_id:
        unidadeId,

      inicio:
        inicio.toISOString(),

      fim:
        fim.toISOString(),

      preco:
        Number(
          servico.preco ||
          0
        ),
    },
  };
}

export async function GET(
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
          erro:
            "Sem permissão.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      recurso,
    } = await params;

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

    const tabela =
      tabelaDe(
        recurso
      );

    const colunas =
      colunasSeguras(
        config
      );

    let consulta =
      db
        .from(
          tabela
        )
        .select(
          colunas
        );

    const recursoComLixeira = ["equipe", "unidades"].includes(recurso);
    const lixeira = recursoComLixeira && new URL(req.url).searchParams.get("lixeira") === "1";
    if (lixeira) {
      const limpeza = await db.rpc(recurso === "unidades" ? "limpar_lixeira_unidades" : "limpar_lixeira_colaboradores");
      if (limpeza.error) throw limpeza.error;
    }
    if (recursoComLixeira) {
      consulta = lixeira ? consulta.not("excluido_em", "is", null) : consulta.is("excluido_em", null);
      if (recurso === "unidades" && lixeira) {
        consulta = consulta.gte("excluido_em", new Date(Date.now() - 86400000).toISOString());
      }
    }

    if (
      config.filtroFixo
    ) {
      consulta =
        consulta.eq(
          config
            .filtroFixo
            .coluna,

          config
            .filtroFixo
            .valor
        );
    }

    if (
      config.ordenar
    ) {
      consulta =
        consulta.order(
          config
            .ordenar
            .coluna,
          {
            ascending:
              config
                .ordenar
                .crescente !==
              false,
          }
        );
    }

    const busca =
      texto(
        new URL(
          req.url
        ).searchParams.get(
          "busca"
        ),
        100
      );

    if (
      busca &&
      config
        .campos?.[0]
        ?.nome
    ) {
      consulta =
        consulta.ilike(
          config
            .campos[0]
            .nome,

          `%${busca}%`
        );
    }

    const {
      data,
      error,
    } = await consulta.limit(
      500
    );

    if (error) {
      return NextResponse.json(
        {
          erro:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    let itens = (data || []).map(sanitizarItem);
    if (lixeira && itens.length) {
      const ids = [...new Set(itens.map((item) => item.excluido_por).filter(Boolean))];
      if (ids.length) {
        const admins = await db.from("usuarios").select("id,nome").in("id", ids);
        if (!admins.error) {
          const nomes = Object.fromEntries((admins.data || []).map((item) => [item.id, item.nome]));
          itens = itens.map((item) => ({ ...item, excluido_por_nome: nomes[item.excluido_por] || null }));
        }
      }
    }

    return NextResponse.json(
      {
        itens,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      {
        erro:
          e?.message ||
          "Não foi possível carregar os dados.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
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
          erro:
            "Sem permissão.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      recurso,
    } = await params;

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

    let corpo;

    try {
      corpo =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          erro:
            "Corpo da requisição inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const erroObrigatorio =
      validarObrigatorios(
        config,
        corpo,
        true
      );

    if (
      erroObrigatorio
    ) {
      return NextResponse.json(
        {
          erro:
            erroObrigatorio,
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

    const tabela =
      tabelaDe(
        recurso
      );

    if (
      tabela ===
        "usuarios" &&
      !dados.senha_hash
    ) {
      return NextResponse.json(
        {
          erro:
            "Defina uma senha de acesso.",
        },
        {
          status: 400,
        }
      );
    }

    if (dados.email) {
      dados.email =
        texto(
          dados.email,
          180
        ).toLowerCase();
    }

    if (recurso === "equipe" && dados.unidade_id) {
      const unidade = await db.from("unidades").select("id").eq("id", dados.unidade_id)
        .eq("ativo", true).is("excluido_em", null).maybeSingle();
      if (unidade.error) throw unidade.error;
      if (!unidade.data) return NextResponse.json({ erro: "A unidade padrão informada não está disponível." }, { status: 400 });
    }

    if (
      recurso ===
      "agendamentos"
    ) {
      const preparado =
        await prepararAgendamento(
          dados
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

    const colunas =
      colunasSeguras(
        config
      );

    const {
      data,
      error,
    } = await db
      .from(
        tabela
      )
      .insert(
        dados
      )
      .select(
        colunas
      )
      .single();

    if (error) {
      if (
        error.code ===
        "23P01"
      ) {
        return NextResponse.json(
          {
            erro:
              "Esse horário já está sendo usado por outro atendimento.",
          },
          {
            status: 409,
          }
        );
      }

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

    return NextResponse.json(
      {
        item:
          sanitizarItem(
            data
          ),
      },
      {
        status: 201,
      }
    );
  } catch (e) {
    return NextResponse.json(
      {
        erro:
          e?.message ||
          "Não foi possível salvar o registro.",
      },
      {
        status: 500,
      }
    );
  }
}
