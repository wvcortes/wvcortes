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

/**
 * Define exatamente quais colunas podem
 * voltar para o navegador.
 *
 * IMPORTANTE:
 * campos do tipo senha nunca são selecionados.
 *
 * Isso impede que senha_hash seja enviado
 * para o painel ao carregar equipe/clientes.
 */
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

/**
 * Segurança extra.
 *
 * Mesmo que alguma consulta futura passe
 * senha_hash acidentalmente, removemos antes
 * de devolver ao navegador.
 */
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

/**
 * Confere os campos obrigatórios definidos
 * em src/lib/recursos.js.
 */
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

/**
 * Regras especiais para um agendamento
 * criado manualmente pelo painel.
 *
 * O navegador NÃO decide:
 *
 * - preço;
 * - duração;
 * - horário final.
 *
 * Tudo isso vem do banco.
 */
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

  if (
    !UUID_RE.test(
      profissionalId
    ) ||
    !UUID_RE.test(
      servicoId
    )
  ) {
    return {
      erro:
        "Serviço ou profissional inválido.",
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

  /**
   * Evita criação de agendamento
   * em horário passado.
   */
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

  /**
   * Confirma serviço e profissional
   * diretamente no banco.
   */
  const [
    servicoResp,
    profissionalResp,
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
        "id, papel, ativo"
      )
      .eq(
        "id",
        profissionalId
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

  const servico =
    servicoResp.data;

  const profissional =
    profissionalResp.data;

  /**
   * Serviço precisa existir e
   * estar disponível.
   */
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

  /**
   * Profissional precisa ser
   * um colaborador ativo.
   */
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

  /**
   * A duração oficial vem do serviço.
   */
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

  /**
   * Calcula automaticamente
   * quando o atendimento termina.
   *
   * Exemplo:
   *
   * Corte social:
   * início 14:00
   * duração 40 min
   *
   * fim = 14:40
   */
  const fim =
    new Date(
      inicio.getTime() +
        duracao *
          60000
    );

  /**
   * Descobre o dia local da barbearia
   * para consultar apenas os agendamentos
   * daquela data.
   */
  const dataLocal =
    diaLocal(
      inicio
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

  /**
   * Um registro já criado como cancelado
   * não precisa reservar horário.
   */
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

    /**
     * Detecta qualquer sobreposição.
     *
     * Exemplo:
     *
     * existente:
     * 14:00 -> 14:40
     *
     * tentativa:
     * 14:30 -> 15:10
     *
     * conflito = verdadeiro
     */
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

  /**
   * Sobrescreve qualquer valor
   * que tenha vindo do navegador.
   */
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
          servico.preco ||
            0
        ),
    },
  };
}

/**
 * GET /api/admin/[recurso]
 *
 * Lista os registros para o painel.
 */
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

    const recurso =
      params.recurso;

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

    /**
     * Antes:
     *
     * select("*")
     *
     * Isso enviava senha_hash de usuarios.
     *
     * Agora selecionamos somente os
     * campos necessários para o painel.
     */
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

    /**
     * Exemplo:
     *
     * equipe:
     * papel = colaborador
     *
     * clientes:
     * papel = cliente
     */
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

    /**
     * Ordenação configurada
     * em recursos.js.
     */
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

    /**
     * Campo de busca.
     */
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

    return NextResponse.json(
      {
        itens:
          (
            data || []
          ).map(
            sanitizarItem
          ),
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

/**
 * POST /api/admin/[recurso]
 *
 * Cria registros pelo painel.
 */
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

    const recurso =
      params.recurso;

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

    /**
     * Validação dos campos
     * obrigatórios.
     */
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

    /**
     * Equipe e clientes utilizam
     * a tabela usuarios.
     *
     * montarPayload transforma:
     *
     * senha
     *
     * em:
     *
     * senha_hash
     */
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

    /**
     * Padroniza o e-mail.
     */
    if (dados.email) {
      dados.email =
        texto(
          dados.email,
          180
        ).toLowerCase();
    }

    /**
     * Regras especiais da agenda.
     */
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

    /**
     * Também no retorno do INSERT
     * usamos apenas colunas seguras.
     */
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